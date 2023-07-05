const chalk = require("chalk");

class User {

    #id;
    #username;
    #title;
    #rating;
    #json;

    constructor() {}

    loadFromJSON(json) {
        this.#id = json.id;
        this.#username = json.username;
        this.#title = json.title;
        this.#rating = json.rating;
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

    getRating() {
        return this.#rating;
    }

    getJSON() {
        return this.#json;
    }

}

module.exports = User;