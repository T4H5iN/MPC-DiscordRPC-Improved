# MPC-DiscordRPC (Improved)

Discord Rich Presence for Media Player Classic with **TMDB integration** for movie/TV show posters and metadata.

![Discord Presence Example](https://i.ibb.co.com/gbzKGfng/image.png)

## Features

- **Show posters** - Displays movie/TV show artwork from TMDB
- **Media titles** - Shows the actual title instead of "Media Player Classic"  
- **Episode info** - Displays "S02E07 - Episode Title" for TV shows
- **Auto-reconnect** - Automatically reconnects when Discord restarts (working on it)
- **System tray** - Runs in background with tray icon
- **Windows startup** - Optional auto-start with Windows

## How It Works

This program fetches playback data from MPC-HC / MPC-BE Web Interface and enriches it with metadata from [The Movie Database (TMDB)](https://www.themoviedb.org/). The result is displayed on your Discord profile through Rich Presence.

**Note:** Only works with [Discord desktop client](https://discordapp.com/download), not the web app.

## Installation

### Prerequisites

**Enable MPC Web Interface**: Open MPC → `View > Options > Player > Web Interface` → Enable `Listen on port:` (default: `13579`)

<!-- ### Option A: Download Pre-built EXE (Recommended)

1. Download `MPC-DiscordRPC-Tray.exe` and `.env.example` from [Releases](../../releases)
2. Rename `.env.example` to `.env`
3. Edit `.env` with your TMDB API key and Discord Application ID
4. Run `MPC-DiscordRPC-Tray.exe` -->

### Run from Source

1. Install [Node.js](https://nodejs.org/en/download/) (v14+)

2. Clone this repository:
   ```sh
   git clone https://github.com/YOUR_USERNAME/MPC-DiscordRPC-Improved.git
   cd MPC-DiscordRPC-Improved
   ```

3. Install dependencies:
   ```sh
   npm install
   ```

4. Run:
   ```sh
   npm start
   ```

## Building EXE

```sh
npx electron-builder --dir
```

The EXE will be created in the `dist/` folder.

## Troubleshooting

**"TMDB_API_KEY not set"**
- Make sure you created a `.env` file with your API key

**Poster not showing**
- Discord caches images; give it a few seconds
- Check if TMDB has the correct movie/show

**"Unable to connect to MPC"**
- Enable Web Interface in MPC options
- Check the port matches in `config.js`

**"Connection to Discord failed"**
- Make sure Discord desktop is running
- The app will auto-retry every 3 seconds

## Credits

- Original project by [angeloanan](https://github.com/angeloanan/MPC-DiscordRPC)
- Movie/TV metadata from [The Movie Database (TMDB)](https://www.themoviedb.org/)

## License

MIT License
