const EventEmitter = require("events");
const { Chess } = require("chess.js");

const GameFull = require("../events/GameFull.js");
const GameState = require("../events/GameState.js");
const ChatLine = require("../events/ChatLine.js");
const OpponentGone = require("../events/OpponentGone.js");

class Game extends EventEmitter {

    #gameId;
    #gameStartEvent;
    #stream;
    #request;
    #board;
    #gameFull;
    #lastState;
    #localUser;
    #isWhite;
    #ourColour;

    constructor(gameStartEvent, stream, request, user) {
        super();

        this.#gameId = gameStartEvent.getGameId();
        this.#gameStartEvent = gameStartEvent;
        this.#stream = stream;
        this.#request = request;
        this.#board = new Chess();
        this.#localUser = user;

        this.#handleStream();
    }

    #handleStream() {
        this.#stream.on("data", event => {
            switch (event.type) {
                case "gameFull":
                    const gameFull = new GameFull();

                    gameFull.loadFromJSON(event);

                    this.#gameFull = gameFull;

                    if (gameFull.getStartingFen() !== "startpos") this.#board.load(gameFull.getStartingFen());

                    const moves = gameFull.getState().getMoves().split(" ");

                    if (moves[0]) {
                        moves.forEach(move => {
                            this.#board.move(
                                decodeMove(move)
                            );
                        });
                    }

                    this.#isWhite = (gameFull.getWhite().getId() === this.#localUser.getId());
                    this.#ourColour = this.#isWhite ? "w" : "b";

                    this.#gameFull = gameFull;
                    this.#lastState = gameFull.getState();

                    this.emit("gameFull", gameFull);

                    if (this.#board.turn() === this.#ourColour) {
                        this.emit("ourTurn");
                    }

                    break;
                case "gameState":
                    const gameState = new GameState();

                    gameState.loadFromJSON(event);
                    
                    const lastMove = gameState.getMoves().split(" ").at(-1);
                    let moveWasMade = false;

                    // This is rather lazy but a quick and simple way to determine if the gameState was sent because of a movement.
                    try {
                        this.#board.move(
                            decodeMove(lastMove)
                        );

                        moveWasMade = true;
                    } catch (_err) {}

                    this.#lastState = gameState;

                    if (this.#board.turn() === this.#ourColour && moveWasMade) {
                        this.emit("ourTurn");
                    }

                    this.emit("gameState", gameState);

                    break;
                case "chatLine":
                    const chatLine = new ChatLine();

                    chatLine.loadFromJSON(event);

                    // do chat event
                    this.emit("chat", chatLine);

                    break;
                case "opponentGone":
                    const opponentGone = new OpponentGone();

                    opponentGone.loadFromJSON(event);

                    this.emit("opponentGone", opponentGone);

                    break;
            }
        });
    }

    getGameId() {
        return this.#gameId;
    }

    sendChatMessage(text) {
        this.#request(`/api/bot/game/${this.#gameId}/chat`, {
            room: "spectator",
            text
        })

        this.#request(`/api/bot/game/${this.#gameId}/chat`, {
            room: "player",
            text
        });
    }

    move(moveString, draw = false) {
        this.#request(`/api/bot/game/${this.#gameId}/move/${moveString}${draw ? "?offeringDraw=true" : ""}`);
    }

    getBoard() {
        return this.#board;
    }

    // w or b
    getColour() {
        return this.#ourColour;
    }

    getGameStart() {
        return this.#gameStartEvent;
    }

    getLastState() {
        return this.#lastState;
    }

}

function decodeMove(moveString) {
    let move = {};

    move.from = moveString.slice(0, 2);
    move.to = moveString.slice(2, 4);

    if (moveString.length === 5) move.promotion = moveString.slice(4);

    return move;
}

module.exports = Game;