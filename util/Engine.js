const { spawn } = require("child_process");
const EventEmitter = require("events");
const { Chess } = require("chess.js");

const OptionList = [
    "name",
    "type",
    "default",
    "min",
    "max",
    "var"
]

const InfoList = [
    "depth",
    "seldepth",
    "time",
    "nodes",
    "pv",
    "multipv",
    "score",
    "currmove",
    "currmovenumber",
    "hashfull",
    "nps",
    "tbhits",
    "cpuload",
    "string",
    "refutation",
    "currline",
    "wdl"
];

const ScoreList = [
    "cp",
    "mate",
    "lowerbound",
    "upperbound"
];

class Engine {

    #enginePath;
    #engineCommands;
    #events;
    #spawnProcess;
    #options;
    #uciReady;
    #name;
    #authors;
    #ponder;
    #chessBoard;
    #isPondering;
    #lastPonderTime;
    #totalPonderTime;

    constructor(enginePath, engineCommands = []) {
        this.#enginePath = enginePath;
        this.#engineCommands = engineCommands;
        this.#events = new EventEmitter();
        this.#options = [];
        this.#uciReady = false;
        this.#chessBoard = new Chess();
        this.#isPondering = false;
        this.#totalPonderTime = 0;
    }

    StartEngine() {
        this.#spawnProcess = spawn(this.#enginePath, this.#engineCommands);

        this.#spawnProcess.stdout.on("data", data => {
            data.toString().split("\n").forEach(line => {
                if (line) this.#events.emit("line", line.replace("\r", "").trim());
            });
        });

        this.#spawnProcess.stderr.on("data", data => {
            // virtually useless data, basically just any extra data the engine wants to write to the console that isn't uci standardized response.
            if (data.toString().trim()) this.#events.emit("stderr", data.toString().trim());
        });

        this.#spawnProcess.on("close", code => {
            this.#events.emit("quit", code);
        });

        this.#StartListening();
    }

    // Keeps current Chess board and event emitter.
    SwitchEngine(enginePath, engineCommands) {
        this.QuitEngine();

        this.#enginePath = enginePath;
        this.#engineCommands = engineCommands;
        this.#options = [];
        this.#uciReady = false;
        this.#isPondering = false;
        this.#totalPonderTime = 0;

        this.StartEngine();
        this.ProposeUCI();
        this.SendPositionFEN();
    }

    WriteEngineCommand(command) {
        this.#events.emit("execute", command);
        this.#spawnProcess.stdin.write(command + "\n");
    }

    GetEventListener() {
        return this.#events;
    }

    #StartListening() {
        this.#events.on("line", line => {
            const splitLine = line.split(" ");
            const instruction = splitLine[0];

            let i, lastArgument;

            switch (instruction) {
                case "option":
                    const option = {};

                    i = 0;
                    lastArgument = undefined;

                    splitLine.forEach(argument => {
                        if (OptionList.includes(argument)) {
                            lastArgument = argument;
                        } else if (argument !== "var" && argument !== "option" && lastArgument !== "var") {
                            if (option[lastArgument]) option[lastArgument] += (" " + argument);
                            if (!option[lastArgument]) option[lastArgument] = argument;
                        }

                        if (argument === "var") {
                            if (!option[argument]) option[argument] = [];
                            option[argument].push(splitLine[i + 1]);
                        }

                        i++;
                    });

                    this.#options.push(option);

                    break;
                case "uciok":
                    this.#uciReady = true;

                    this.#events.emit("options", this.#options);

                    break;
                case "readyok":
                    this.#events.emit("ready");

                    break;
                case "id":
                    let type = splitLine[1];

                    splitLine.shift();
                    splitLine.shift();

                    if (type === "name") this.#name = splitLine.join(" ");
                    if (type === "author") this.#authors = splitLine.join(" ");

                    if (this.#name && this.#authors) this.#events.emit("id", this.#name, this.#authors);

                    break;
                case "info":
                    const info = {};

                    i = 0;
                    lastArgument = undefined;

                    splitLine.forEach(argument => {
                        if (InfoList.includes(argument)) {
                            lastArgument = argument;
                        } else if (argument !== "info") {
                            if (info[lastArgument]) info[lastArgument] += (" " + argument);
                            if (!info[lastArgument]) info[lastArgument] = argument;
                        }

                        i++;
                    });

                    if (info["score"]) {
                        let newSplitScore = info["score"].split(" ");

                        info["score"] = {};
                        i = 0;

                        newSplitScore.forEach(argument => {
                            if (ScoreList.includes(argument)) {
                                info["score"][argument] = newSplitScore[i + 1];
                            }

                            i++;
                        });
                    }

                    if (info["wdl"]) {
                        info["wdl"] = info["wdl"].split(" ");

                        info["wdl"].forEach((part, index) => {
                            info["wdl"][index] = parseInt(part);
                        });
                    }

                    info.raw = line;

                    this.#events.emit("engineThought", info);

                    break;
                case "bestmove":
                    const consideredMove = splitLine[1];
                    let ponder;
                    
                    if (splitLine[2] === "ponder") {
                        this.#ponder = splitLine[3];
                        ponder = splitLine[3];
                    } else {
                        this.#ponder = undefined;
                    }

                    this.#events.emit("calculatedMove", consideredMove, ponder);

                    break;
                default:
                    break;
            }
        });
    }

    ProposeUCI() {
        this.WriteEngineCommand("uci");
    }
    
    AskReady() {
        this.WriteEngineCommand("isready");
    }

    SetOption(key, value) {
        this.WriteEngineCommand("setoption name " + key + " value " + value);
    }

    QuitEngine() {
        this.WriteEngineCommand("quit");
        
        // If engine hasn't shutdown (no exitCode has been given yet) after 5 seconds then force kill the process.
        setTimeout(() => {
            if (this.#spawnProcess.exitCode === null) this.#spawnProcess.kill("SIGKILL");
        }, 5000);
    }

    SendPositionFEN(fen) {
        // safeguard against position fen undefined - crashes stockfish
        if (fen) this.WriteEngineCommand("position fen " + fen);
    }

    SetPositionFEN(fen, sendPosition = true) {
        this.#chessBoard = new Chess(fen);
        if (sendPosition) this.SendPositionFEN(this.#chessBoard.fen());
    }

    SendPositionJoined(fen = "startpos", moves = "") {
        // position <fen <fen position>/startpos> [moves <following move list with separator " ">]
        this.WriteEngineCommand("position " + (fen !== "startpos" ? " fen " : "") + fen + (moves ? (" moves " + moves) : ""));
    }

    Move(moveString) {
        let move = {};

        move.from = moveString.slice(0, 2);
        move.to = moveString.slice(2, 4);

        // promotion
        if (moveString[4]) move.promotion = moveString.slice(4);

        this.#chessBoard.move(move);

        this.SendPositionFEN(this.#chessBoard.fen());
    }

    PonderHit() {
        this.WriteEngineCommand("ponderhit");
        this.NoPonderHit();
    }

    NoPonderHit() {
        let ponderDifference = new Date().getTime() - this.#lastPonderTime;

        this.#isPondering = false;
        if (!isNaN(ponderDifference)) this.#totalPonderTime += ponderDifference;
    }

    GoPonder(whiteTimeMs, blackTimeMs, increment) {
        // Tells engine we are playing the pondered move then asks engine to ponder about the move until ponderhit is called and the engine considers the time it has.
        this.WriteEngineCommand(`go ponder wtime ${whiteTimeMs} btime ${blackTimeMs} winc ${increment} binc ${increment}`);
        this.#isPondering = true;
        this.#lastPonderTime = new Date().getTime();
    }

    UndoMove() {
        this.#chessBoard.undo();
        this.SendPositionFEN();
    }

    GetPonderTime() {
        return this.#totalPonderTime + (this.#isPondering ? (new Date().getTime() - this.#lastPonderTime) : 0);
    }

    CalculateMove(whiteTimeMs, blackTimeMs, increment, infinite = false) {
        this.WriteEngineCommand(`go wtime ${whiteTimeMs} btime ${blackTimeMs} winc ${increment} binc ${increment}${infinite ? " infinite" : ""}`);
    }

    CalculateDepth(depth) {
        this.WriteEngineCommand(`go depth ${depth}`);
    }

    CalculateTime(time) {
        this.WriteEngineCommand(`go movetime ${time}`);
    }

    StopCalculating() {
        if (this.#isPondering) this.NoPonderHit();
        this.WriteEngineCommand("stop");
        this.SendPositionFEN();
    }

    GetUCIReady() {
        return this.#uciReady;
    }

    GetEngineName() {
        return this.#name;
    }

    GetEngineAuthors() {
        return this.#authors;
    }

    GetOptions() {
        return this.#options;
    }
    
    GetPonder() {
        return this.#ponder;
    }

    IsPondering() {
        return this.#isPondering;
    }

    GetChessBoard() {
        return this.#chessBoard;
    }

}

module.exports = Engine;