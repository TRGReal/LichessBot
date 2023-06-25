const chalk = require("chalk");

class User {

    #id;
    #username;
    #title;
    #json;

    constructor() {}

    loadFromJSON(json) {
        this.#id = json.id;
        this.#username = json.username;
        this.#title = json.title;
        this.#json = json;
    }

    getId() {
        return this.#id;
    }

    getUsername() {
        return this.#username;
    }

    getTitle() {
        return this.#title;
    }

    getJSON() {
        return this.#json;
    }

}

module.exports = User;