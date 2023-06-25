class TimeControl {

    #type;
    #time;
    #increment;
    #displayedTime;

    constructor() {}

    loadFromJSON(json) {
        this.#type = json.type;
        this.#time = json.limit;
        this.#increment = json.increment;
        this.#displayedTime = json.show;
    }

    getType() {
        return this.#type;
    }

    getTime() {
        return this.#time;
    }

    getIncrement() {
        return this.#increment;
    }

    getDisplayedTime() {
        return this.#displayedTime;
    }

}

module.exports = TimeControl;