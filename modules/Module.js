class Module {

    #name;
    #description;

    constructor(name, description) {
        this.#name = name;
        this.#description = description;
    }

    getName() {
        return this.#description;
    }

    getDescription() {
        return this.#description;
    }

    handleChallengeRequest() {}
    handleGameStart() {}
    handleGameFull() {}
    handleGameState() {}
    handleOurTurn() {}

}

module.exports = Module;