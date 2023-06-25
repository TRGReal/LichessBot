const User = require("../structures/User.js");

class GameStart {

    #gameId;
    #fullGameId;
    #colour;
    #fen;
    #hasMoved;
    #isMyTurn;
    #lastMove;
    #opponent;
    #perf;
    #rated;
    #secondsLeft;
    #source;
    #status;
    #speed;
    #variant;
    #compat;

    constructor() {}

    loadFromJSON(json) {
        this.#gameId = json.gameId;
        this.#fullGameId = json.fullId;
        this.#colour = json.color;
        this.#fen = json.fen;
        this.#hasMoved = json.hasMoved;
        this.#isMyTurn = json.isMyTurn;
        this.#lastMove = json.lastMove;
        this.#opponent = new User();

        this.#opponent.loadFromJSON(json.opponent);

        this.#perf = json.perf;
        this.#rated = json.rated;
        this.#secondsLeft = json.secondsLeft;
        this.#source = json.source;
        this.#status = json.status;
        this.#speed = json.speed;
        this.#variant = json.variant;
        this.#compat = json.compat;
    }

    getGameId() {
        return this.#gameId;
    }

    getFullGameId() {
        return this.#fullGameId;
    }

    getColour() {
        return this.#colour;
    }

    getFen() {
        return this.#fen;
    }

    hasMoved() {
        return this.#hasMoved;
    }

    isMyTurn() {
        return this.#isMyTurn;
    }

    getLastMove() {
        return this.#lastMove;
    }

    getOpponent() {
        return this.#opponent;
    }

    getPerf() {
        return this.#perf;
    }

    isRated() {
        return this.#rated;
    }

    getSecondsLeft() {
        return this.#secondsLeft;
    }

    getSource() {
        return this.#source;
    }

    getStatus() {
        return this.#status;
    }

    getSpeed() {
        return this.#speed;
    }

    getVariant() {
        return this.#variant;
    }

    getCompat() {
        return this.#compat;
    }

}

module.exports = GameStart;