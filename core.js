/**
 * MPC-DiscordRPC Core Module
 * Handles fetching MPC data and sending Rich Presence updates
 */

const log = require('fancy-log'),
    jsdom = require('jsdom'),
    { ignoreBrackets, ignoreFiletype, replaceUnderscore, replaceDots } = require('./config'),
    { parseFilename } = require('./mediaParser'),
    { readVideoMetadata, isReadable } = require('./metadataReader'),
    tmdb = require('./tmdbClient'),
    { JSDOM } = jsdom;

// Trim strings to Discord's 128 character limit
String.prototype.trimStr = function (length) {
    return this.length > length ? this.substring(0, length - 3) + "..." : this;
};

// Playback state tracking
let playback = {
    filename: '', position: '', duration: '', state: '',
    prevState: '', prevPosition: '', prevFilename: ''
};

// Cache for TMDB metadata
let mediaCache = {};

// State display strings
const states = {
    '-1': { string: 'Idling', stateKey: 'stop_small' },
    '0': { string: 'Stopped', stateKey: 'stop_small' },
    '1': { string: 'Paused', stateKey: 'pause_small' },
    '2': { string: 'Watching', stateKey: 'play_small' }
};

/**
 * Get media info - tries embedded metadata first, then filename parsing
 * @param {string} filename - Just the filename
 * @param {string} filepath - Full file path
 */
async function getMediaInfo(filename, filepath) {
    if (mediaCache[filename]) return mediaCache[filename];

    let parsed = null;
    let fromMetadata = false;

    // Try reading embedded metadata first
    if (filepath && isReadable(filepath)) {
        try {
            const meta = await readVideoMetadata(filepath);
            if (meta && (meta.show || meta.title)) {
                parsed = {
                    title: meta.show || meta.title,
                    year: meta.year,
                    season: meta.season || 1,
                    episode: meta.episode,
                    type: (meta.show || meta.season || meta.episode) ? 'tv' : 'movie'
                };
                fromMetadata = true;
                log.info(`INFO: From metadata - "${parsed.title}" S${parsed.season}E${parsed.episode}`);
            }
        } catch (err) {
            log.warn(`WARN: Metadata read failed: ${err.message}`);
        }
    }

    // Fallback to filename parsing
    if (!parsed) {
        parsed = parseFilename(filename);
        log.info(`INFO: From filename - "${parsed.title}" (${parsed.type}${parsed.season ? `, S${parsed.season}E${parsed.episode}` : ''})`);
    }

    // Search TMDB
    const result = await tmdb.searchMedia(parsed);

    const info = {
        title: result?.title || parsed.title,
        posterUrl: result?.posterUrl || null,
        season: parsed.season,
        episode: parsed.episode,
        episodeName: result?.episodeName || null,
        type: parsed.type,
        fromMetadata: fromMetadata
    };

    mediaCache[filename] = info;
    return info;
}

/**
 * Convert time string 'hh:mm:ss' to seconds
 */
function toSeconds(time) {
    const parts = time.split(':');
    const seconds = parseInt(parts[parts.length - 1]);
    const minutes = parseInt(parts[parts.length - 2]);
    const hours = parts.length > 2 ? parseInt(parts[0]) : 0;
    return (hours * 3600) + (minutes * 60) + seconds;
}

/**
 * Remove leading '00:' from time if hours is 0
 */
function sanitizeTime(time) {
    return time.split(':')[0] === '00' ? time.substr(3) : time;
}

/**
 * Main presence update function
 */
const updatePresence = async (res, rpc) => {
    const mpcFork = res.headers.server.replace(' WebServer', '');
    const { document } = new JSDOM(res.data).window;

    // Get playback data
    const filepath = document.getElementById('filepath').textContent;
    const filename = filepath.split("\\").pop().trimStr(128);
    const state = document.getElementById('state').textContent;
    const duration = sanitizeTime(document.getElementById('durationstring').textContent);
    const position = sanitizeTime(document.getElementById('positionstring').textContent);

    playback = { ...playback, filename, state, duration, position };

    // Get media info (cached)
    let mediaInfo = null;
    if (state !== '-1' && state !== '0') {
        try {
            mediaInfo = await getMediaInfo(filename, filepath);
        } catch (err) {
            log.error('ERROR:', err.message);
        }
    }

    // Build display strings (Plex-style layout)
    let displayTitle = mediaInfo?.title || mpcFork;
    let displayState = '';

    if (mediaInfo?.type === 'tv' && mediaInfo.season && mediaInfo.episode) {
        displayState = `S${mediaInfo.season} • E${mediaInfo.episode}`;
        if (mediaInfo.episodeName) {
            displayState += ` - ${mediaInfo.episodeName}`;
        }
    }
    displayState = displayState.trimStr(128) || `${position} / ${duration}`;

    // Build payload
    let payload = {
        type: 3, // Watching
        details: displayTitle.trimStr(128),
        state: displayState,
        assets: {
            large_image: mediaInfo?.posterUrl || (mpcFork === 'MPC-BE' ? 'mpcbe_logo' : 'default'),
            large_text: displayTitle.trimStr(128),
            small_image: states[state].stateKey,
            small_text: states[state].string
        }
    };

    // Handle state-specific changes
    if (state === '-1') {
        // Idling
        payload.details = undefined;
        payload.state = 'Idling';
        payload.assets.large_image = mpcFork === 'MPC-BE' ? 'mpcbe_logo' : 'default';
        payload.assets.large_text = mpcFork;
    } else if (state === '1') {
        // PAUSED - NO timestamps (freezes the progress bar)
        // Just show the position in the state text if no episode info
        if (!mediaInfo?.type || mediaInfo.type !== 'tv') {
            payload.state = `${position} / ${duration}`;
        }
        // No timestamps = frozen progress bar
    } else if (state === '2') {
        // PLAYING - use timestamps for live progress bar
        // PRESENCE-FOR-PLEX uses MILLISECONDS! trying to match that.
        const positionMs = toSeconds(position) * 1000;
        const durationMs = toSeconds(duration) * 1000;
        const now = Date.now(); // Milliseconds

        payload.timestamps = {
            start: now - positionMs,
            end: now + (durationMs - positionMs)
        };
    }

    // Add status_display_type (undocumented field used by Plex)
    // Trying 1 (STATE) to see if it triggers the "more visible" bar style
    payload.status_display_type = 1;

    // Only send update when something actually changes
    const shouldUpdate = (state !== playback.prevState) ||
        (filename !== playback.prevFilename);

    if (shouldUpdate) {
        rpc.setActivity(payload);
        log.info(`INFO: ${states[state].string} - ${displayTitle} - ${displayState}`);
    }

    // Save previous state
    playback.prevState = state;
    playback.prevPosition = position;
    playback.prevFilename = filename;

    return true;
};

module.exports = updatePresence;
