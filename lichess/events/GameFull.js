const GameState = require("./GameState.js");
const User = require("../structures/User.js");

class GameFull {

    #gameId;
    #variant;
    #clock;
    #rated;
    #createdAt;
    #white;
    #black;
    #fen;
    #state;

    constructor() {}

    loadFromJSON(json) {
        this.#gameId = json.id;
        this.#variant = json.variant;
        this.#clock = json.clock;
        this.#rated = json.rated;
        this.#createdAt = json.createdAt;
        this.#white = new User();
        this.#black = new User();

        this.#white.loadFromJSON(json.white);
        this.#black.loadFromJSON(json.black);

        this.#fen = json.initialFen;
        this.#state = new GameState();
        
        this.#state.loadFromJSON(json.state);
    }

    getGameId() {
        return this.#gameId;
    }

    getVariant() {
        return this.#variant;
    }

    getClock() {
        return this.#clock;
    }

    isRated() {
        return this.#rated;
    }

    getCreationTime() {
        return this.#createdAt;
    }

    getWhite() {
        return this.#white;
    }

    getBlack() {
        return this.#black;
    }

    getStartingFen() {
        return this.#fen;
    }

    getState() {
        return this.#state;
    }

}

module.exports = GameFull;