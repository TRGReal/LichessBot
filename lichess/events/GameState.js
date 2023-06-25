class GameState {

    #moves;
    #whiteTime;
    #blackTime;
    #whiteIncrement;
    #blackIncrement;
    #status;
    #winner;
    #whiteDraw;
    #blackDraw;
    #whiteTakeback;
    #blackTakeback;

    constructor() {}

    loadFromJSON(json) {
        this.#moves = json.moves;
        this.#whiteTime = json.wtime;
        this.#blackTime = json.btime;
        this.#whiteIncrement = json.winc;
        this.#blackIncrement = json.binc;
        this.#status = json.status;
        this.#winner = json.winner;
        this.#whiteDraw = json.wdraw;
        this.#blackDraw = json.bdraw;
        this.#whiteTakeback = json.wtakeback;
        this.#blackTakeback = json.btakeback;
    }

    getMoves() {
        return this.#moves;
    }

    getWhiteTime() {
        return this.#whiteTime;
    }

    getBlackTime() {
        return this.#blackTime;
    }

    getWhiteIncrement() {
        return this.#whiteIncrement;
    }

    getBlackIncrement() {
        return this.#blackIncrement;
    }

    getStatus() {
        return this.#status;
    }
    
    getWinner() {
        return this.#winner;
    }

    isWhiteOfferingDraw() {
        return this.#whiteDraw;
    }

    isBlackOfferingDraw() {
        return this.#blackDraw;
    }

    isWhiteRequestingTakeback() {
        return this.#whiteTakeback;
    }

    isBlackRequestingTakeback() {
        return this.#blackTakeback;
    }

}

module.exports = GameState;