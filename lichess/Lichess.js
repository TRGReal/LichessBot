const https = require("https");
const EventEmitter = require("events");

const User = require("./structures/User.js");
const Challenge = require("./structures/Challenge.js");
const Game = require("./structures/Game.js");

// Events
const GameStart = require("./events/GameStart.js");

const DefaultRequestMethod = "POST";
const DefaultAPIHost = "lichess.org";

// All http/https methods that communicate with data.
const MethodsWithData = [
    "PUT",
    "POST"
];

function makeRequest(apiPath, rawData, oauth, method = DefaultRequestMethod, host = DefaultAPIHost) {
    const emitter = new EventEmitter();

    const isDataMethod = MethodsWithData.includes(method);
    const data = JSON.stringify(rawData);

    const connectionOptions = {
        host,
        port: 443,
        path: apiPath,
        method,
        headers: {
            Authorization: `Bearer ${oauth}`
        }
    };

    if (isDataMethod) {
        connectionOptions.headers["Content-Type"] = "application/json";
        connectionOptions.headers["Content-Length"] = data.length;
    }

    const request = https.request(connectionOptions, (res) => {
        if (res.statusCode === 204) emitter.emit("data"); // 204 - No Content

        res.on("data", buffer => {
            const string = buffer.toString().trim();

            if (string) {
                string.split("\n").forEach(unparsedData => {
                    try {
                        const data = JSON.parse(unparsedData);

                        emitter.emit("data", data);
                    } catch (_err) {
                        throw _err;
                        // Error is most likely caused by it being unable to parse the JSON, so we'll pass the raw data to
                        // the application and let it handle it.
                        emitter.emit("data", unparsedData);
                    }
                });
            }
        })

        res.on("close", () => {
            emitter.emit("close");
        });
    
        res.on("error", err => {
            emitter.emit(err);
        });
    });

    if (isDataMethod) request.write(data);

    request.end();

    request.on("error", err => {
        emitter.emit("error", err);
    });

    return emitter;
}

function handleRequestErrors(request) {
    request.on("error", err => {
        throw err;
    });
}

class LichessBot extends EventEmitter {

    #oauth;
    #user;
    #activeGames;

    constructor() {        
        super();

        this.#activeGames = []
    }

    login(oauth) {
        this.#oauth = oauth;

        this.#prepareBot();
    }

    // not static because of oauth
    #quickRequest(path, data = {}, method = DefaultRequestMethod) {
        return makeRequest(path, data, this.#oauth, method);
    }

    #prepareBot() {
        const accountRequest = this.#quickRequest("/api/account", {}, "GET");
        handleRequestErrors(accountRequest);

        accountRequest.on("data", json => {
            this.#user = new User();

            this.#user.loadFromJSON(json);

            if (this.#user.getTitle() !== "BOT") throw new Error("OAuth token must be a bot account! Learn how at https://lichess.org/@/thibault/blog/how-to-create-a-lichess-bot/FuKyvDuB")

            this.emit("userLoaded", this.#user);
            this.#streamIncomingEvents();
        });
    }

    #streamIncomingEvents() {
        const eventStreamer = this.#quickRequest("/api/stream/event", {}, "GET");
        handleRequestErrors(eventStreamer);

        eventStreamer.on("data", json => {
            switch (json.type) {
                case "challenge":
                    const ChallengeRequest = new Challenge((accepted, reason) => {
                        if (accepted) {
                            this.#quickRequest(`/api/challenge/${ChallengeRequest.getChallengeId()}/accept`);
                        } else {
                            this.#quickRequest(`/api/challenge/${ChallengeRequest.getChallengeId()}/decline`, {
                                reason
                            });

                            this.emit("challengeDeclined", ChallengeRequest, reason);
                        }
                    });

                    ChallengeRequest.loadFromJSON(json.challenge);

                    if (ChallengeRequest.getChallenger().getId() !== this.#user.getId()) this.emit("challengeRequest", ChallengeRequest);

                    break;
                case "gameStart":
                    const gameStart = new GameStart();

                    gameStart.loadFromJSON(json.game);

                    const gameStream = this.#quickRequest(`/api/bot/game/stream/${gameStart.getGameId()}`, {}, "GET");
                    handleRequestErrors(gameStream);
                    
                    const game = new Game(gameStart, gameStream, (path, data = {}, method = DefaultRequestMethod) => {
                        return this.#quickRequest(path, data, method);
                    }, this.#user);

                    this.#activeGames.push(game);

                    this.emit("gameStart", game);

                    break;
                case "gameFinish":
                    // remove game from active games

                    break;
                default:
                    break;
            }
        });
    }

    getGames() {
        return this.#activeGames;
    }

    getUser() {
        return this.#user;
    }

}

module.exports = LichessBot;