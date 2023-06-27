const Challenge = require("./Challenge");

class ChallengeDecline extends Challenge {

    #declineReason;
    #declineKey;

    constructor() {
        super();
    }

    loadFromJSON(json) {        
        this.#declineReason = json.declineReason;
        this.#declineKey = json.declineReasonKey;

        super.loadFromJSON(json);
    }

    getDeclineReason() {
        return this.#declineReason;
    }

    getDeclineKey() {
        return this.#declineKey;
    }

}

module.exports = ChallengeDecline;
