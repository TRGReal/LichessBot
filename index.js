const { jsonc } = require("jsonc");
const fs = require("fs");
const { Chess } = require("chess.js");
const https = require("https");
const os = require("os");
const extractZip = require("extract-zip");
const rimraf = require("rimraf");
const tar = require("tar");

const config = jsonc.parse(fs.readFileSync("./config.jsonc", "utf8"));
const oauth = fs.readFileSync("./oauth.txt", "utf8");

const Lichess = require("./lichess/Lichess.js");
const Logger = require("./util/Logger.js");
const Engine = require("./util/Engine.js");

const LocalLogger = new Logger(config.logger.template, config.logger.debug, config.logger.fileLogger);

// Create folders and files
const directoryList = fs.readdirSync("./");

if (!directoryList.includes(config.logger.fileLogger.directory)) {

}

const client = new Lichess();

client.on("userLoaded", user => {
    LocalLogger.info(`Ready to accept games! (playing as ${user.getTitle(0)} ${user.getUsername()})`);
});

client.on("challengeRequest", ChallengeRequest => {
    // If challenge request wasn't sent by self.
    if (ChallengeRequest.getChallenger().getId() !== client.getUser().getId()) {
        LocalLogger.game(`Got challenge request from ${ChallengeRequest.getChallenger().getId()}.`, ChallengeRequest.getChallengeId(), false, "challenges");

        // Challenge Decline Reasons
        if (ChallengeRequest.getChallenger().getId() !== "trgreal") return ChallengeRequest.declineChallenge("generic");

        // We will accept the challenge and wait for Lichess to tell us the game is ready (by awaiting for gameStart).
        LocalLogger.game(`Accepted challenge request.`, ChallengeRequest.getChallengeId(), true, "challenges");
        ChallengeRequest.acceptChallenge();
    }
});

client.on("gameStart", game => {
    const gameStart = game.getGameStart();
    
    const gameId = gameStart.getGameId();
    const opponent = gameStart.getOpponent();

    let ignoreEngineMove = false;

    LocalLogger.game(`Preparing game with ${opponent.getUsername()}...`, gameId);

    const SelectedEngine = config.engines[0];
    const LocalEngine = new Engine("./engine/" + SelectedEngine.path);
    const EngineEvents = LocalEngine.GetEventListener();
    const EngineOptions = SelectedEngine.uciOptions;

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

    game.on("gameFull", gameFull => {

        // The engine has decided on a move.
        EngineEvents.on("calculatedMove", (move, ponder) => {
            if (!ignoreEngineMove) {
                // Play the move chosen.
                game.move(move);

                if (config.consoleAnnouncements.announcePlayedMove) LocalLogger.game("Engine chose move: " + LocalEngine.GetPonder(), game.getGameId(), false, "engine");

                // The engine has decided a move to ponder on.
                if (ponder) {
                    const lastState = game.getLastState();

                    LocalEngine.SendPositionJoined(gameFull.getStartingFen(), (lastState.getMoves() + ponder));
                    LocalEngine.GoPonder(lastState.getWhiteTime(), lastState.getBlackTime(), lastState.getWhiteIncrement());

                    if (config.consoleAnnouncements.announcePonder) LocalLogger.game("Pondering move: " + LocalEngine.GetPonder(), game.getGameId(), false, "engine");
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
            
            let ponderHit = false;

            // If the first element in the list is "" (suggesting there are no moves), remove the first element (signifying no moves).
            if (!moveList[0]) moveList.shift()

            if (LocalEngine.IsPondering()) {
                // If the last move played by the opponent was the same as what our engine predicted, tell it that they played a move.
                if (moveList.at(-1) === LocalEngine.GetPonder()) {
                    LocalEngine.PonderHit();

                    if (config.consoleAnnouncements.announcePonderHit) LocalLogger.game("Opponent played the pondered move: " + LocalEngine.GetPonder(), game.getGameId(), false, "engine");

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
                LocalEngine.SendPositionJoined(gameFull.getStartingFen(), game.getLastState().getMoves());
                LocalEngine.CalculateMove(lastState.getWhiteTime(), lastState.getBlackTime(), lastState.getWhiteIncrement());

                if (config.consoleAnnouncements.announcePonderHit) LocalLogger.game("Considering opponent move: " + LocalEngine.GetPonder(), game.getGameId(), false, "engine");
            }
        });

    });

});

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
    client.login(oauth);
}

const engineDownload = config.engines[0].autoEngineDownload;

if (engineDownload.enabled) {
    LocalLogger.info("Automatically downloading engines...");

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