const chalk = require("chalk");

class Logger {

    #debugMode;
    #messageTemplate;

    constructor(template = "{id}", debug = false, fileLogging) {
        this.#debugMode = debug;
        this.#messageTemplate = template;
    }

    #template(message) {
        const date = new Date();
        console.log(this.#messageTemplate.replace("{message}", message).replace("{date}", `[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]`));
    }

    debug(message) {
        if (this.#debugMode) this.#template(chalk.gray(message));
    }

    confirm(message) {
        this.#template(chalk.green(message));
    }

    info(message) {
        this.#template(chalk.white(message));
    }

    warning(message) {
        this.#template(chalk.yellow(message));
    }

    error(message) {
        this.#template(chalk.red(message));
    }

    game(message, id, confirm = false, communication = "game") {
        this.info(`[${id} <=> ${communication}] ${message}`);
    }

}

module.exports = Logger;