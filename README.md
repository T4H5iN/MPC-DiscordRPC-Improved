# MPC-DiscordRPC (Improved)

Discord Rich Presence for Media Player Classic with **TMDB integration** for movie/TV show posters and metadata.

![Discord Presence Example](https://i.imgur.com/QAAJZgL.png)

## Features

- 🎬 **Show posters** - Displays movie/TV show artwork from TMDB
- 📺 **Media titles** - Shows the actual title instead of "Media Player Classic"  
- 📝 **Episode info** - Displays "S02E07 - Episode Title" for TV shows
- 🔄 **Auto-reconnect** - Automatically reconnects when Discord restarts
- 🖥️ **System tray** - Runs in background with tray icon
- 🚀 **Windows startup** - Optional auto-start with Windows

## How It Works

This program fetches playback data from MPC-HC / MPC-BE Web Interface and enriches it with metadata from [The Movie Database (TMDB)](https://www.themoviedb.org/). The result is displayed on your Discord profile through Rich Presence.

**Note:** Only works with [Discord desktop client](https://discordapp.com/download), not the web app.

## Installation

### Prerequisites

1. **Enable MPC Web Interface**: Open MPC → `View > Options > Player > Web Interface` → Enable `Listen on port:` (default: `13579`)

2. **Get TMDB API Key** (free): Register at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)

3. **Create Discord Application** (for "Watching" text): Go to [discord.com/developers/applications](https://discord.com/developers/applications), create an app, copy the Application ID

### Option A: Download Pre-built EXE (Recommended)

1. Download `MPC-DiscordRPC-Tray.exe` and `.env.example` from [Releases](../../releases)
2. Rename `.env.example` to `.env`
3. Edit `.env` with your TMDB API key and Discord Application ID
4. Run `MPC-DiscordRPC-Tray.exe`

### Option B: Run from Source

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

4. Create `.env` file (copy from `.env.example`):
   ```env
   TMDB_API_KEY=your_tmdb_api_key_here
   DISCORD_CLIENT_ID=your_discord_app_id_here
   ```

5. Run:
   ```sh
   # Console mode
   npm start
   
   # System tray mode
   npm run tray
   ```

## Auto-Start with Windows

Run `install-startup.bat` to add MPC-DiscordRPC to Windows startup.

To remove from startup, run `uninstall-startup.bat`.

## Building EXE

To compile into a standalone executable:

```sh
npm run build:tray
```

The EXE will be created in the `dist/` folder.

## Configuration

### `.env` File

| Variable | Description | Required |
|----------|-------------|----------|
| `TMDB_API_KEY` | Your TMDB API key for poster lookup | Yes |
| `DISCORD_CLIENT_ID` | Your Discord Application ID | No (uses default) |

### `config.js` Options

| Option | Default | Description |
|--------|---------|-------------|
| `port` | `13579` | MPC Web Interface port |
| `ignoreBrackets` | `true` | Remove `[tags]` from filenames |
| `ignoreFiletype` | `false` | Hide file extension |
| `replaceUnderscore` | `true` | Replace `_` with spaces |
| `replaceDots` | `true` | Replace `.` with spaces |
| `showRemainingTime` | `false` | Show remaining time instead of elapsed |

## How Filenames Are Parsed

The app intelligently extracts media info from filenames:

| Filename | Detected |
|----------|----------|
| `Fallout 2024 S02E07 1080p WEB.mkv` | TV: "Fallout", Season 2, Episode 7 |
| `Dune Part Two 2024 AMZN WEB-DL.mkv` | Movie: "Dune Part Two", 2024 |
| `[SubGroup] Anime Name - 05.mkv` | TV: "Anime Name", Episode 5 |

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
- The app will auto-retry every 10 seconds

## Credits

- Original project by [angeloanan](https://github.com/angeloanan/MPC-DiscordRPC)
- Movie/TV metadata from [The Movie Database (TMDB)](https://www.themoviedb.org/)

## License

MIT License
