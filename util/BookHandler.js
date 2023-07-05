const BufferUtils = require("./BufferUtils.js");
const zlib = require("zlib");

class BookHandler {

    #loadedBuffer;
    #fenList;
    #loaded;
    #movesPerFen;
    #inflatedSize;

    constructor(movesPerFen) {
        this.#fenList = {};
        this.#loaded = false;
        this.#movesPerFen = movesPerFen;
    }

    loadFile(buffer) {
        const inflated =  zlib.inflateSync(buffer);
        const buf = new BufferUtils(inflated);

        this.#loadedBuffer = buf;
        this.#inflatedSize = inflated.length;
        
        try {
            while (buf.cursor !== buf.length) {
                const fen = buf.readString();
                const moveArrayLength = buf.readU8();

                this.#fenList[fen] = [];

                for (let i = 0; i < moveArrayLength; i++) {
                    // best move is always 4 bytes (in LAN notation) therefore we can save
                    // space by not including var int string length and just say that it is
                    // 4 bytes.
                    const bestMove = buf.readBytes(4).buf.toString();
                    buf.read8(); // cp difference, ignored
                    const cp = buf.read8();

                    if (this.#fenList[fen].length < this.#movesPerFen) this.#fenList[fen].push({
                        bestMove,
                        cp
                    });
                }
            }

            this.#loaded = true;
        } catch (err) {
            console.error(err);
            throw new Error("Failed to load book! Cursor: " + buf.cursor);
        }
    }

    isLoaded() {
        return this.#loaded;
    }

    searchFen(fen) {
        return this.#fenList[fen];
    }

    getFenList() {
        return this.#fenList;
    }

    getInflatedSize() {
        return this.#inflatedSize;
    }

}

module.exports = BookHandler;