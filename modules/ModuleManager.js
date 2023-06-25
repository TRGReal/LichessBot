const fs = require("fs");

class ModuleManager {

    #moduleList;

    constructor() {
        this.#loadModules();
    }

    #loadModules() {
        const moduleDirectory = fs.readdirSync("./impl/");

        moduleDirectory.forEach(module => {
            if (module.endsWith(".js")) {
                

                this.#moduleList = require(`./impl/${module}`);


            }
        });
    }

}

module.exports = ModuleManager;