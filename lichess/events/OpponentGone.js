class OpponentGone {

    #gone;
    #winClaimSeconds;

    constructor() {}

    loadFromJSON(json) {
        this.#gone = json.gone;
        this.#winClaimSeconds = json.claimWinInSeconds;
    }

    isGone() {
        return this.#gone;
    }

    claimWinIn() {
        return this.#winClaimSeconds;
    }

}

module.exports = OpponentGone;