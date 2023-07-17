const BufferUtils = require("./BufferUtils.js");
const crypto = require("crypto");
const bitwise = require("bitwise");
const fs = require("fs");

// Efficient 2-byte move storage using 6-bits per move and 4-bits for promotion.
const promotionResult = {
    nothing: 0,
    n: 1,
    b: 2,
    r: 3,
    q: 4
}

const fileCorrespondence = {
    a: 0,
    b: 1,
    c: 2,
    d: 3,
    e: 4,
    f: 5,
    g: 6,
    h: 7
}

function positionToBitArray(positionString) {
    // Position goes up each file then crosses over a rank
    // and starts from the bottom going up the file again.
    // e.g. a1 -> a2 -> a3 -> ... -> a8 -> b1 -> b2
    const file = fileCorrespondence[positionString.slice(0, 1)];
    const rank = parseInt(positionString.slice(1, 2));
    const position = parseInt((file * 8) + rank);
    const bits = bitwise.byte.read(position).reverse();

    return bits;
}

function bitArrayToPosition(bitArray) {
    let number = bitArray[0] * 1 +
                bitArray[1] * 2 +
                bitArray[2] * 4 +
                bitArray[3] * 8 +
                bitArray[4] * 16 +
                bitArray[5] * 32;
    
    // Since the integer 64 cannot be stored, it is overflown to 0
    // which is never taken so we manually set this to 64
    // if the value ever hits 0.
    if (number === 0) number = 64;

    const fileNumber = Math.floor((number - 1) / 8);
    const file = Object.entries(fileCorrespondence)[fileNumber][0];
    const rank = number - (fileNumber * 8);

    return (file + rank);
}

function bitArrayToPromotion(bitArray) {
    const number = bitArray[0] * 1 +
                   bitArray[1] * 2 +
                   bitArray[2] * 4 +
                   bitArray[3] * 8;
    return Object.entries(promotionResult)[number][0];
}

function convertBufferToMove(moveBuffer) {
    const bits = bitwise.buffer.read(moveBuffer).reverse();
    const from = bitArrayToPosition(bits.slice(0, 6));
    const to = bitArrayToPosition(bits.slice(6, 12));
    let promotion = bitArrayToPromotion(bits.slice(12, 16));

    promotion = (promotion === "nothing") ? "" : promotion;

    return (from + to + promotion);
}

function convertMoveToBuffer(moveString) {
    const from = moveString.slice(0, 2);
    const to = moveString.slice(2, 4);
    let promotion = "nothing";

    if (moveString[4]) promotion = moveString[4];

    promotion = promotionResult[promotion];

    const fromBits = positionToBitArray(from);
    const toBits = positionToBitArray(to); 
    const promotionBits = bitwise.byte.read(promotion).reverse();

    let totalBits = [];

    totalBits = totalBits.concat(
                                    fromBits.slice(0, 6),
                                    toBits.slice(0, 6),
                                    promotionBits.slice(0, 4)
                                );

    const finalBuffer = bitwise.buffer.create(totalBits.reverse());

    return finalBuffer;
}

// Testing Positions - just a sanity check to ensure
// you haven't screwed over the positioning bits
// when changing the code.
function generatePositions() {
    const positions = [];

    for (const file in fileCorrespondence) {
        for (let i = 1; i <= 8; i++) {
            positions.push(file + i);
        }
    }

    return positions;
}

let total = 0;

generatePositions().forEach(pos => {
    generatePositions().forEach(pos2 => {
        total++;
        const converted = convertMoveToBuffer(pos + pos2);
        const reverted = convertBufferToMove(converted);

        if (reverted !== (pos + pos2)) {
            throw new Error("misaligned position buffer! " + (pos + pos2) + " returned " + reverted);
        }
    });
});

class BookHandler {

    #positionList;
    #loaded;
    #movesPerPosition;
    #total;
    #writeStream;

    constructor(movesPerPosition) {
        this.#positionList = {};
        this.#loaded = false;
        this.#movesPerPosition = movesPerPosition;
        this.#total = 0;
    }

    loadFile(location) {
        const buf = new BufferUtils(fs.readFileSync(location));
        
        try {
            while (buf.cursor !== buf.length) {
                this.#total++;

                const sha = buf.readBytes(32).buf;
                const moveArrayLength = buf.readU8();

                // If a hash collision occurs (which is literally virtually impossible unless you're working with something like CRC)
                // then we want to avoid this because this tells us that a position is going to be overwritten
                // in the position list which could give for incorrect book plays/movements - this could also lead
                // to running out of time due to the bot having no idea what to do.
                if (this.#positionList[sha]) throw new Error("Hash collision detected! Cannot continue.");

                this.#positionList[sha] = [];

                for (let i = 0; i < moveArrayLength; i++) {
                    const bestMove = convertBufferToMove(buf.readBytes(2).buf);
                    const cp = buf.readVarInt();

                    if (this.#positionList[sha].length < this.#movesPerPosition) this.#positionList[sha].push({
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

        this.startWriteStream(location, buf.buf);
    }

    startWriteStream(location, startBuffer) {
        this.#writeStream = fs.createWriteStream(location);
        this.#writeStream.write(startBuffer);
    }

    isLoaded() {
        return this.#loaded;
    }

    #createHash(text) {
        return crypto.createHash("sha256").update(text).digest();
    }

    searchFen(fen) {
        // convert the fen to a SHA-256 hash (which is what the book uses for each position)
        // then search the position list to see if it occurs.
        return this.#positionList[this.#createHash(fen)];
    }

    appendFenResult(fen, move, cp) {
        const FenHash = this.#createHash(fen);
        const FenBuffer = new BufferUtils();

        FenBuffer.writeBytes(FenHash);
        FenBuffer.writeU8(1); // Only 1 move to write.

        FenBuffer.writeBytes(convertMoveToBuffer(move));
        FenBuffer.writeVarInt(cp);

        this.#writeStream.write(FenBuffer.buf);
    }

    getPositionList() {
        return this.#positionList;
    }

    getTotal() {
        return this.#total;
    }

}

module.exports = BookHandler;