const GameStart = require("./GameStart.js");

class GameFinish extends GameStart {

    #winner;

    constructor() {
        super();
    }

    loadFromJSON(json) {
        this.#winner = json.winner;

        super.loadFromJSON(json);
    }

    getWinner() {
        return this.#winner;
    }

}

module.exports = GameFinish;