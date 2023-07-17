<div align="center">

[![lichess-logo-link]][lichess-link]

</div>

## Description

I made a cool Lichess NodeJS bot, it's still in development and **very** experimental. My inspiration for this project was the lack of other good (in my opinion) bots with lots of options and customizability and also the fact that I just enjoy programming.

This was made from the minimal amount of dependencies to code clean and uncluttered - this meant creating a Lichess API interface from scratch.

Any pull requests/issues of changes or suggestions/fixes are most welcome.

## Installation

In the future, this project will be packaged with [**pkg**][pkg-link] in the [**Releases**][release-link] tab.

In the mean time:
 - Ensure NodeJS and NPM are both installed on your system (if not installed, download from [here][nodejs-link]).
 - Clone the project using `git clone https://github.com/TRGReal/LichessBot.git` or by downloading it from [here][code-download-link].
 - Change the `config.json` to your preferences of how you would like the bot to run.
 - Replace the text in `oauth.token.example` with your oauth token from Lichess (if you don't have one, get a token from [here][lichess-oauth-link]), then rename the file to `oauth.token`.
 - Enter the folder in a command line and run the command `npm install` to install dependencies.
 - After installing dependencies, you can start the bot with `node index.js`.
 - Your bot should now be online and ready to accept challenges!

## License

This project currently does not have a license.

If you wish for a license to be added, please make a pull request with a reason on why it should be added! *(note: a license with the permission to sell the use of this code (or edited forks) will **not** be accepted for obvious reasons)*

## Notes

- If the engine seems to be throttled by Windows (e.g. the CPU percentage usage is low), it seems that running the command prompt in administrator fixes it.

[pkg-link]: https://github.com/vercel/pkg
[release-link]: https://github.com/TRGReal/LichessBot/releases
[code-download-link]: https://github.com/TRGReal/LichessBot/archive/refs/heads/main.zip
[nodejs-link]: https://nodejs.org/
[lichess-oauth-link]: https://lichess.org/account/oauth/token
[lichess-logo-link]: https://upload.wikimedia.org/wikipedia/commons/a/af/Landscape-Lichess-logo.jpg
[lichess-link]: https://lichess.org/