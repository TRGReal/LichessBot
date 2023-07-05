const { jsonc } = require("jsonc");
const fs = require("fs");
const { Chess } = require("chess.js");
const https = require("https");
const os = require("os");
const extractZip = require("extract-zip");
const rimraf = require("rimraf");
const tar = require("tar");
const EventEmitter = require("events");
const { WebSocketServer } = require("ws");

const config = jsonc.parse(fs.readFileSync("./config.jsonc", "utf8"));
const oauth = fs.readFileSync("./oauth.token", "utf8");

const Lichess = require("./lichess/Lichess.js");
const Logger = require("./util/Logger.js");
const Engine = require("./util/Engine.js");
const BookHandler = require("./util/BookHandler.js");

// Create folders and files
if (!fs.existsSync(config.logger.fileLogger.directory)) {
    fs.mkdirSync(config.logger.fileLogger.directory);
}

if (!fs.existsSync("./engine/")) {
    fs.mkdirSync("./engine/");
}

if (!fs.existsSync("./engine/githubAssetId")) {
    fs.writeFileSync("./engine/githubAssetId", "");
}

const LocalLogger = new Logger(config.logger.template, config.logger.debug, config.logger.fileLogger);
// For events to be sent to the module manager.
const ModuleEmitter = new EventEmitter();
const OpeningBook = new BookHandler(config.openingBook.movesPerFen);

if (config.openingBook.enabled) {
    const time = new Date().getTime();
    LocalLogger.debug("Loading OpeningBook...");
    
    OpeningBook.loadFile(fs.readFileSync(config.openingBook.path));

    const timeDifference = (new Date().getTime()) - time;
    const roundedMegabyteSize = Math.round(
        (JSON.stringify(OpeningBook.getFenList()).length / 1000000)
    * 10) / 10;

    LocalLogger.info(`Loaded OpeningBook in ${timeDifference / 1000}s.`);
    LocalLogger.debug(` => inflated size of ${OpeningBook.getInflatedSize() / 1000000} MB.`);
    LocalLogger.debug(` => expanded memory size of ${roundedMegabyteSize} MB.`);
}

let wss;
let wssTime = new Date().getTime();

if (config.websocketHtmlStreamer.enabled) {
    const port = config.websocketHtmlStreamer.port;

    wss = new WebSocketServer({ port });

    LocalLogger.debug("WebSocket server starting on port " + port + ".");
}

// https://lichess.org/api#tag/Bot/operation/botGameStream
// all statuses that aren't a gameOver.
const GameRunningStatuses = [
    "created",
    "started",
];

const client = new Lichess();

client.on("userLoaded", user => {
    LocalLogger.success(`Ready to accept games! (playing as ${user.getTitle(0)} ${user.getUsername()})`);
});

client.on("challengeRequest", ChallengeRequest => {
    // If challenge request wasn't sent by self.
    if (ChallengeRequest.getChallenger().getId() !== client.getUser().getId()) {
        LocalLogger.game(`Got challenge request from ${ChallengeRequest.getChallenger().getId()}.`, ChallengeRequest.getChallengeId(), false, "challenges");

        const timeControl = ChallengeRequest.getTimeControl();

        // Challenge Decline Reasons
        if (!config.challengeRequests.timeControl.acceptedModes.includes(ChallengeRequest.getSpeed())) return ChallengeRequest.declineChallenge("timeControl");
        if (timeControl.getType() === "unlimited") return ChallengeRequest.declineChallenge("timeControl");
        if (timeControl.getTime() < config.challengeRequests.timeControl.minimumTime) return ChallengeRequest.declineChallenge("toofast");
        if (timeControl.getIncrement() < config.challengeRequests.timeControl.minimumIncrement) return ChallengeRequest.declineChallenge("toofast");
        if (!config.challengeRequests.acceptsRated && ChallengeRequest.isRated()) return ChallengeRequest.declineChallenge("casual");
        if (!config.challengeRequests.acceptsCasual && !ChallengeRequest.isRated()) return ChallengeRequest.declineChallenge("rated");
        if (!config.challengeRequests.variants.includes(ChallengeRequest.getVariant().key)) return ChallengeRequest.declineChallenge("variant");
        if (client.getGames().length >= config.challengeRequests.maxActiveGames) return ChallengeRequest.declineChallenge("generic");

        // We will accept the challenge and wait for Lichess to tell us the game is ready (by awaiting for gameStart).
        LocalLogger.game(`Accepted challenge request.`, ChallengeRequest.getChallengeId(), true, "challenges");
        ChallengeRequest.acceptChallenge();
    }
});

client.on("challengeDeclined", ChallengeDecline => {
    LocalLogger.game(`Declined challenge request, reason: ${ChallengeDecline.getDeclineKey()}`, ChallengeDecline.getChallengeId(), false, "lichess");
});

function convertNumber(num) {
    if ((num / 1000000) >= 1) {
        return ((num / 1000000) + " MN");
    } else {
        return ((num / 100000) + " KN");
    }
}

let wssClients = [];

if (wss) {
    wss.on("connection", socket => {
        wssClients.push(socket);

        LocalLogger.debug(`WebSocket connection on ${socket._socket.remoteAddress}.`);

        socket.on("close", () => {
            // Removes all clients from the array that have the same socket as the disconnecter.
            wssClients = wssClients.filter(clientSocket => clientSocket !== socket);
        });
    });

    wss.on("listening", () => {
        LocalLogger.info("WebSocket Server started listening successfully.");
        LocalLogger.debug(` => in ${new Date().getTime() - wssTime}ms.`);
    });
}

client.on("gameStart", game => {
    const gameStart = game.getGameStart();
    
    const gameId = gameStart.getGameId();
    const opponent = gameStart.getOpponent();
    let ourUser;
    const colour = gameStart.getColour() === "white" ? "w" : "b";

    let ignoreEngineMove = false;
    let announcedDiscoveredMate = false;
    let shouldPrintEval = false;
    let lastThought;
    let ponderMove = [ ];

    LocalLogger.game(`Preparing game with ${opponent.getUsername()}...`, gameId);

    const SelectedEngine = config.engines[0];
    const LocalEngine = new Engine("./engine/" + SelectedEngine.path, SelectedEngine.commandLineArguments);
    const EngineEvents = LocalEngine.GetEventListener();
    const EngineOptions = SelectedEngine.uciOptions;

    // Start the engine process.
    LocalEngine.StartEngine();

    // Ask the engine if we can use the UCI protocol (there is no detection for failure, UCI is assumed).
    LocalEngine.ProposeUCI();

    // Set UCI engine options.
    for (const option in EngineOptions) {
        const value = EngineOptions[option];

        LocalEngine.SetOption(option, value);
    }

    // Ask the engine if it is ready to go.
    LocalEngine.AskReady();

    const greetingsMessage = config.chatMessages.greetingsMessage;

    if (greetingsMessage.enabled) game.sendChatMessage(greetingsMessage.message);

    const updateWssClients = () => {
        const fen = game.getBoard().fen();
        const isWhite = (colour === "w");
        const sendArray = [];

        if (!lastThought || !lastThought.pv) {
            sendArray.push(fen);
            sendArray.push([]);
            sendArray.push(isWhite);
            sendArray.push("");
            sendArray.push("8/8/8/8/8/8/8/8");
            sendArray.push("...");
            sendArray.push("...");
            sendArray.push("...");
            sendArray.push("...");
        } else {
            const boardClone = new Chess(fen);
            let pvArray = lastThought.pv.split(" ");
            
            pvArray.forEach(pvMove => {
                if (pvMove) {
                    // Move errors may be caused by engine PV lines containing invalid moves.
                    try {
                        Move(pvMove, boardClone);
                    } catch (_err) { }
                }
            });

            let cp = lastThought.score.cp;

            const advantageSide = isWhite ? 1 : -1;

            if (isNaN(cp)) {
                cp = ("#" + (lastThought.score.mate * advantageSide));
            } else {
                cp = (cp / 100) * advantageSide;
                if (cp > 0) cp = `+${cp}`;
            }

            let ponderArray = [];

            if (ponderMove && ponderMove.from && ponderMove.to) {
                ponderArray.push(ponderMove.from);
                ponderArray.push(ponderMove.to);
            } else {
                ponderArray = "";
            }

            sendArray.push(fen);
            sendArray.push(ponderArray);
            sendArray.push(isWhite);
            sendArray.push(lastThought.pv);
            sendArray.push(boardClone.fen());
            sendArray.push(lastThought.depth);
            sendArray.push(cp);
            sendArray.push(convertNumber(lastThought.nps) + "/s");
            sendArray.push((lastThought.time / 1000) + " seconds");
            sendArray.push("");
            sendArray.push(lastThought.score.cp * advantageSide);
        }

        wssClients.forEach(client => {
            client.send(JSON.stringify(sendArray));
        });
    };

    game.on("gameFull", gameFull => {

        if (colour === "w") ourUser = gameFull.getWhite();
        if (colour === "b") ourUser = gameFull.getBlack();

        const speed = gameFull.getSpeed();
        // correspondence is not seeing the board correctly
        const longTC = speed === "correspondence" || speed === "unlimited";

        EngineEvents.on("engineThought", thought => {
            if (thought.score && thought.score.mate && !announcedDiscoveredMate) {
                announcedDiscoveredMate = true;

                const forcedMateMessage = config.chatMessages.discoveredMateMessage;

                if (forcedMateMessage.enabled) game.sendChatMessage(forcedMateMessage.message.replace("{moves}", thought.score.mate));
            }

            if (thought.score) {
                lastThought = thought;

                updateWssClients();
            }
        });

        // The engine has decided on a move.
        EngineEvents.on("calculatedMove", (move, ponder) => {
            if (!ignoreEngineMove) {
                // Play the move chosen.
                game.move(move);

                if (shouldPrintEval) {
                    const evalMessage = config.chatMessages.evalMessage;

                    if (evalMessage.enabled) {
                        let message = evalMessage.message;

                        const nodes = convertNumber(lastThought.nodes);
                        let nps = convertNumber(lastThought.nps) + "/s";
                        let cp = lastThought.score.cp;

                        if (cp) cp /= 100;
                        if (isNaN(cp)) cp = ("#" + lastThought.score.mate);

                        message = message.replace("{eval}", cp);
                        message = message.replace("{depth}", lastThought.depth);
                        message = message.replace("{nodes}", nodes);
                        message = message.replace("{nps}", nps);
                        message = message.replace("{hashfull}", (lastThought.hashfull / 10) + "%")

                        game.sendChatMessage(message);
                    }
                }

                if (config.consoleAnnouncements.announcePlayedMove) LocalLogger.game("Engine chose move: " + move, gameFull.getGameId(), false, "engine");

                // The engine has decided a move to ponder on.
                // (will not ponder on long time control (correspondence, unlimited)).
                if (ponder && !longTC) {
                    const lastState = game.getLastState();

                    ponderMove = MoveArray(ponder);

                    LocalEngine.SendPositionJoined(gameFull.getStartingFen(), `${lastState.getMoves()} ${move} ${ponder}`);
                    LocalEngine.GoPonder(lastState.getWhiteTime(), lastState.getBlackTime(), lastState.getWhiteIncrement());

                    if (config.consoleAnnouncements.announcePonder) LocalLogger.game("Pondering move: " + LocalEngine.GetPonder(), gameFull.getGameId(), false, "engine");
                }
            }
    
            ignoreEngineMove = false;
        });

        EngineEvents.on("ready", () => {
            const loadedMessage = config.chatMessages.engineLoadedMessage;

            if (loadedMessage.enabled) game.sendChatMessage(loadedMessage.message.replace("{engine_name}", LocalEngine.GetEngineName()).replace("{opponent}", opponent.getId()));
        });

        game.on("ourTurn", () => {
            const lastState = game.getLastState();
            const moveList = lastState.getMoves().split(" ");
            const lastMove = moveList.at(-1) ?? "starting position";

            ponderMove = [ ];

            // Search the opening book for the FEN of the game to see what moves we can play.
            const BookMoves = OpeningBook.searchFen(game.getBoard().fen());

            let playBook = false;
            let bookMove;

            if (BookMoves) {
                playBook = true;
                bookMove = BookMoves[0].bestMove;
            }
            
            if (playBook) {
                game.move(bookMove);
            } else {
                if (longTC) {
                    LocalEngine.CalculateTime(config.challengeRequests.timeControl.correspondenceTime * 1000);
                } else {
                    let ponderHit = false;

                    // If the first element in the list is "" (suggesting there are no moves), remove the first element (signifying no moves).
                    if (!moveList[0]) moveList.shift();

                    if (LocalEngine.IsPondering()) {
                        // If the last move played by the opponent was the same as what our engine predicted, tell it that they played a move.
                        if (moveList.at(-1) === LocalEngine.GetPonder()) {
                            LocalEngine.PonderHit();

                            if (config.consoleAnnouncements.announcePonderHit) LocalLogger.game("Opponent played the pondered move: " + LocalEngine.GetPonder(), gameFull.getGameId(), false, "engine");

                            ponderHit = true;
                        } else {
                            // If the pondered move isn't played, we let the engine know and continue on with the position.
                            LocalEngine.NoPonderHit();
                            LocalEngine.StopCalculating();

                            ignoreEngineMove = true;
                        }
                    }

                    if (!ponderHit) {
                        // Let the engine know our current state.
                        LocalEngine.SendPositionJoined(gameFull.getStartingFen(), lastState.getMoves());
                        LocalEngine.CalculateMove(lastState.getWhiteTime(), lastState.getBlackTime(), lastState.getWhiteIncrement());

                        if (config.consoleAnnouncements.announcePonderHit) LocalLogger.game("Considering opponent move: " + lastMove, gameFull.getGameId(), false, "engine");
                    }
                }
            }
        });

        game.on("gameState", state => {
            updateWssClients();

            const gameStatus = state.getStatus();

            // If the game has ended.
            if (!GameRunningStatuses.includes(gameStatus)) {
                // Just incase the engine decides to send a move and we cause errors.
                ignoreEngineMove = true;
                LocalEngine.QuitEngine();
                LocalLogger.game("Game has concluded, result: " + gameStatus, gameFull.getGameId(), false, "lichess");
            } else {
                // If the game is still running, run the draw checks.
                let offeringDraw = false;

                if (game.getColour() === "w") offeringDraw = state.isBlackOfferingDraw();
                if (game.getColour() === "b") offeringDraw = state.isWhiteOfferingDraw();

                if (offeringDraw) {
                    LocalLogger.game("Opponent is offering a draw.", gameId, false, "game");

                    let shouldDraw = false;

                    if (lastThought) {
                        // If accepting draws is enabled.
                        if (config.gameSettings.draws.enabled) {
                            // If the current centipawn evaluation by the engine is within the given bounds of within the config.
                            if (lastThought.score.cp <= config.gameSettings.draws.maxCpAdvantage) {
                                // If the rating difference between us and them is within a reasonable range (given in the config).
                                if ((ourUser.getRating() + config.gameSettings.draws.maxRatingDifference) <= opponent.getRating()) {
                                    shouldDraw = true;
                                }
                            }
                        }
                    }

                    // If it is a casual game.
                    if (!gameFull.isRated()) shouldDraw = true;

                    if (shouldDraw) {
                        LocalLogger.game("Accepted draw.", gameId, true, "game");
                        game.move("a1a1", true);
                    } else {
                        LocalLogger.game("Declined draw.", gameId, false, "game");
                    }
                }
            }
        });

        game.on("chat", chat => {
            const text = chat.getText();
            const arguments = text.split(" ");
            const prefix = arguments[0];

            switch (prefix) {
                case "!help":
                    const helpMessage = config.chatMessages.helpMessage;

                    if (helpMessage.enabled) game.sendChatMessage(helpMessage.message);

                    break;
                case "!printeval":
                    const printEvalEnabled = config.chatMessages.printEvalEnabled;

                    if (printEvalEnabled.enabled) game.sendChatMessage(printEvalEnabled.message);

                    shouldPrintEval = !shouldPrintEval;

                    break;
                default:
                    break;
            }
        });

    });

});

function Move(board, moveString) {
    let move = {};

    move.from = moveString.slice(0, 2);
    move.to = moveString.slice(2, 4);

    if (moveString.length === 5) move.promotion = moveString.slice(4);

    return board.move(move);
}

function MoveArray(moveString) {
    let move = {};

    move.from = moveString.slice(0, 2);
    move.to = moveString.slice(2, 4);

    // promotion
    if (moveString[4]) move.promotion = moveString.slice(4);

    return move;
}

function downloadFile(link, destinationStream) {
    return new Promise((resolve, reject) => {
        https.get(link, res => {
            if (res.statusCode === 302) { // relocated
                downloadFile(res.rawHeaders[res.rawHeaders.indexOf("Location") + 1], destinationStream).then(resolve);
            } else {
                res.pipe(destinationStream);

                res.on("end", () => {
                    resolve();
                });
            }
        });
    });
}

function login() {
    LocalLogger.info("Connecting to Lichess.org...");
    client.login(oauth);
}

const engineDownload = config.engines[0].autoEngineDownload;

// this part isn't very well coded but eh it'll be better in the future
if (engineDownload.enabled) {
    LocalLogger.info("Checking engines to automatically download...");

    for (const engine in engineDownload.engines) {
        if (engineDownload.engines[engine]) {
            switch (engine) {
                case "stockfish-dev":
                    https.get({
                        "headers": {
                            "User-Agent": "NodeJS"
                        },
                        "path": "/repos/official-stockfish/stockfish/releases",
                        "host": "api.github.com"
                    }, res => {
                        let finalData = "";

                        res.on("data", data => {
                            finalData += data;
                        });

                        res.on("end", () => {
                            const json = JSON.parse(finalData);
                            const latest = json[0];

                            const assetId = latest.id;
                            const localAssetId = fs.readFileSync("./engine/githubAssetId");

                            if (assetId != localAssetId) {
                                fs.writeFileSync("./engine/githubAssetId", assetId.toString());

                                const architechture = os.arch();
                                const platform = os.platform();
                                
                                let asset;

                                if (architechture !== "x64") {
                                    throw new Error("Unsupported architechture for automatic engine downloading, please use the default engine path feature. " + architechture);
                                } else {
                                    switch (platform) {
                                        case "win32":
                                            asset = latest.assets.find(asset => asset.name === "stockfish-windows-x86-64-modern.zip");

                                            break;
                                        case "linux":
                                            LocalLogger.warning("Automatic engine downloader detected Linux platform, assuming Ubuntu.");

                                            asset = latest.assets.find(asset => asset.name === "stockfish-ubuntu-x86-64-modern.tar");

                                            break;
                                        default:
                                            throw new Error("Unsupported platform for automatic engine downloading, please use the default engine path feature. " + platform)
                                    }
                                }

                                downloadFile(asset.browser_download_url, fs.createWriteStream(`./engine/${asset.name}`)).then(() => {
                                    LocalLogger.info("Downloaded. Extracting engine...");

                                    if (asset.name.endsWith(".zip")) {
                                        extractZip("./engine/" + asset.name, {
                                            "dir": `${__dirname}\\engine\\`
                                        }).then(() => {
                                            const exeName = asset.name.replace("zip", "exe");

                                            fs.renameSync("./engine/stockfish/" + exeName, "./engine/" + exeName);
                                            fs.rmSync("./engine/" + asset.name);
                                            rimraf.sync("./engine/stockfish/");

                                            login();
                                        });
                                    } else if (asset.name.endsWith(".tar")) {
                                        tar.extract({
                                            file: "./engine/" + asset.name
                                        }).then(() => {
                                            const exeName = asset.name.replace(".tar", "");

                                            fs.renameSync("./stockfish/" + exeName, "./engine/" + exeName);
                                            fs.rmSync("./engine/" + asset.name);
                                            rimraf.sync("./stockfish/");

                                            login();
                                        });
                                    }
                                });
                                
                                LocalLogger.info(`Downloading ${asset.name}...`);
                            } else {
                                login();
                            }
                        });
                    });

                    break;
                default:
                    break;
            }
        }
    }
} else {
    login();
}