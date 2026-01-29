# MPC-DiscordRPC (Improved)

Discord Rich Presence for Media Player Classic with **TMDB & Jikan integration** for movie/TV show posters and metadata.

![Discord Presence Example](https://i.ibb.co.com/6RyzjHh0/image.png) ![Discord Presence Example](https://i.ibb.co.com/FL4ZLNvS/image.png)

## Features

- **Show posters** - Displays movie/TV show artwork from TMDB
- **Anime support** - Falls back to Jikan API (MyAnimeList) for anime metadata and episode titles
- **Media titles** - Shows the actual title instead of filename
- **Episode info** - Displays "S02E07 - Episode Title" for TV shows
- **Smart parsing** - Handles various filename formats (SubsPlease, Erai-raws, standard S01E01, etc.)
- **System tray** - Runs in background with tray icon
- **Windows startup** - Optional auto-start with Windows
- **Auto-Reconnect** - Automatically reconnects to Discord when it comes back online

## How It Works

This program fetches playback data from MPC-HC / MPC-BE Web Interface and enriches it with metadata from:
- [The Movie Database (TMDB)](https://www.themoviedb.org/) - Primary source for movies & TV shows
- [Jikan API](https://jikan.moe/) - Fallback for anime episode info when TMDB fails

**Note:** Only works with [Discord desktop client](https://discordapp.com/download), not the web app.

## Installation

### Prerequisites

**Enable MPC Web Interface**: Open MPC → `View > Options > Player > Web Interface` → Enable `Listen on port:` (default: `13579`)

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

## Building

### Requirements
- Node.js v14+
- npm

### Build Portable EXE (unpacked)

```sh
npx electron-builder --dir
```

Output: `dist/win-unpacked/MPC-DiscordRPC.exe`

### Build Installer

```sh
npm run dist
```

Output: `dist/MPC-DiscordRPC-<version>-windows-x64.exe` `dist/MPC-DiscordRPC-<version>-windows-x64.zip`

## Troubleshooting

**Poster not showing**
- Discord caches images; give it a few seconds
- Check if TMDB has the correct movie/show

**Episode title missing for anime**
- The app will automatically try Jikan API when TMDB fails
- Multi-season anime (e.g. "Oshi no Ko S3") are handled automatically

**"Unable to connect to MPC"**
- Enable Web Interface in MPC options
- Check the port matches in `config.js`

**"Connection to Discord failed"**
- Make sure Discord desktop is running
- The app will auto-retry every 3 seconds

## Credits

- Original project by [angeloanan](https://github.com/angeloanan/MPC-DiscordRPC)
- Movie/TV metadata from [The Movie Database (TMDB)](https://www.themoviedb.org/)
- Anime metadata from [Jikan API](https://jikan.moe/) (MyAnimeList)

## License

MIT License
