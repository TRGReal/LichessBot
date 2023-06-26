const fs = require("fs");

class ModuleManager {

    #moduleList;

    constructor(ModuleEmitter = new EventEmitter()) {
        this.#loadModules();
    }

    #loadModules() {
        const moduleDirectory = fs.readdirSync("./impl/");

        moduleDirectory.forEach(module => {
            if (module.endsWith(".js")) {
                // Load module.
                const module = require(`./impl/${module}`);

                // Add to module list for events to be sent to later.
                this.#moduleList.push(module);


            }
        });
    }

}

module.exports = ModuleManager;