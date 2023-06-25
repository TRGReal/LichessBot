class ChatLine {

    #username;
    #text;
    #room;

    constructor() {}

    loadFromJSON(json) {
        this.#username = json.username;
        this.#text = json.text;
        this.#room = json.room;
    }

    getUsername() {
        return this.#username;
    }

    getText() {
        return this.#text;
    }

    getRoom() {
        return this.#room;
    }

}

module.exports = ChatLine;