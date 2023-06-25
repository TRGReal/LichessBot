const User = require("./User.js");
const TimeControl = require("./TimeControl.js");

class Challenge {

    #challengeId;
    #url;
    #status;
    #challenger;
    #destination;
    #variant;
    #rated;
    #speed;
    #timeControl;
    #chosenColour;
    #colour;
    #perf;
    #callback;

    constructor(decisionCallback) {
        this.#callback = decisionCallback;
    }

    loadFromJSON(json) {
        this.#challengeId = json.id;
        this.#url = json.url;
        this.#status = json.status;
        this.#challenger = new User();
        this.#destination = new User();

        this.#challenger.loadFromJSON(json.challenger);
        this.#destination.loadFromJSON(json.destUser);

        this.#variant = json.variant;
        this.#rated = json.rated;
        this.#speed = json.speed;
        this.#timeControl = new TimeControl();

        this.#timeControl.loadFromJSON(json.timeControl);

        this.#chosenColour = json.color;
        this.#colour = json.finalColor;
        this.#perf = json.perf;
    }

    getChallengeId() {
        return this.#challengeId;
    }

    getUrl() {
        return this.#url;
    }

    getStatus() {
        return this.#status;
    }

    getChallenger() {
        return this.#challenger;
    }

    getDestination() {
        return this.#destination;
    }

    getVariant() {
        return this.#variant;
    }

    isRated() {
        return this.#rated;
    }

    getSpeed() {
        return this.#speed;
    }

    getTimeControl() {
        return this.#timeControl;
    }

    getChosenColour() {
        return this.#chosenColour;
    }

    getColour() {
        return this.#colour;
    }

    getPerf() {
        return this.#perf;
    }

    acceptChallenge() {
        this.#callback(true);
    }

    declineChallenge(reason) {
        this.#callback(false, reason);
    }

}

module.exports = Challenge;