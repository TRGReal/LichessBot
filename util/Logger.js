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
        console.log(this.#messageTemplate.replace("{message}", message).replace("{time}", `[${prependZero(date.getHours())}:${prependZero(date.getMinutes())}:${prependZero(date.getSeconds())}]`));
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
        let resultMessage = `[${id} <=> ${communication}] ${message}`;
        
        if (!confirm) this.#template(resultMessage);
        if (confirm) this.#template(chalk.green(resultMessage));
    }

    success(message) {
        this.#template(chalk.green(message));
    }

}

function prependZero(number) {
    return ("0" + number).slice(-2);
}

module.exports = Logger;