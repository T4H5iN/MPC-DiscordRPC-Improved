/**
 * MPC-DiscordRPC Core Module
 * Handles fetching MPC data and sending Rich Presence updates
 */

const log = require('fancy-log'),
    jsdom = require('jsdom'),
    { parseFilename } = require('./mediaParser'),
    tmdb = require('./tmdbClient'),
    jikan = require('./jikanClient'),
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
 * Check if filename looks like episode-only (starts with number)
 * Examples: "01 - Title", "01.Title", "01_Title", "1 Title"
 */
function isEpisodeOnlyFilename(filename) {
    const pattern = /^(\d{1,3})\s*[-._\s]/;
    return pattern.test(filename);
}

/**
 * Extract episode number from episode-only filename
 */
function extractEpisodeNumber(filename) {
    const pattern = /^(\d{1,3})\s*[-._\s]/;
    const match = filename.match(pattern);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Search folder hierarchy for a valid show name
 * Checks parent, grandparent, great-grandparent folders
 * @param {string} filepath - Full file path
 * @returns {string|null} - Cleaned show title or null
 */
function findShowNameFromFolders(filepath) {
    const pathParts = filepath.split(/[\/\\]/);

    // Start from parent folder and go up to great-grandparent (3 levels)
    for (let i = pathParts.length - 2; i >= Math.max(0, pathParts.length - 4); i--) {
        const folderName = pathParts[i];

        // Skip drive letters and empty parts
        if (!folderName || folderName.match(/^[A-Z]:$/i)) continue;

        // Skip generic folder names
        const genericFolders = ['movies', 'tv', 'anime', 'videos', 'downloads', 'torrents', 'media', 'shows', 'series'];
        if (genericFolders.includes(folderName.toLowerCase())) continue;

        // Parse folder name to clean it
        const parsed = parseFilename(folderName + '.mkv');

        // If folder name looks like a valid show title (not episode-only)
        if (parsed.title && parsed.title.length > 2 && !isEpisodeOnlyFilename(parsed.title)) {
            log.info(`INFO: Found show name from folder: "${parsed.title}" (level: ${pathParts.length - 1 - i})`);
            return parsed.title;
        }
    }

    return null;
}

/**
 * Get media info using filename parsing and folder detection
 * @param {string} filename - Just the filename
 * @param {string} filepath - Full file path
 */
async function getMediaInfo(filename, filepath) {
    if (mediaCache[filename]) return mediaCache[filename];

    // Parse filename first
    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    let parsed = parseFilename(filename);
    let fromFolder = false;

    // Check if filename is episode-only (e.g., "01 - Bust Through the Heavens.mkv")
    if (isEpisodeOnlyFilename(filenameWithoutExt)) {
        const episodeNum = extractEpisodeNumber(filenameWithoutExt);

        // Search folder hierarchy for show name
        const showName = findShowNameFromFolders(filepath);

        if (showName) {
            parsed.title = showName;
            parsed.episode = episodeNum;
            parsed.season = 1; // Default to season 1 for anime
            parsed.type = 'tv';
            fromFolder = true;
            log.info(`INFO: From folder hierarchy - "${parsed.title}" S${parsed.season}E${parsed.episode}`);
        } else {
            log.info(`INFO: From filename (episode-only, no folder match) - "${parsed.title}"`);
        }
    } else {
        log.info(`INFO: From filename - "${parsed.title}" (${parsed.type}${parsed.season ? `, S${parsed.season}E${parsed.episode}` : ''})`);
    }

    // Search TMDB first
    let result = await tmdb.searchMedia(parsed);
    let source = 'tmdb';

    // If TMDB fails and this looks like anime (tv type or from folder), try Jikan
    if (!result && (parsed.type === 'tv' || fromFolder)) {
        log.info(`INFO: TMDB miss, trying Jikan for anime...`);
        const animeResult = await jikan.searchAnime(parsed.title);
        if (animeResult) {
            result = {
                title: animeResult.title,
                posterUrl: animeResult.posterUrl,
                episodeName: null
            };
            source = 'jikan';

            // Try to get episode title
            if (animeResult.mal_id && parsed.episode) {
                const epInfo = await jikan.getEpisodeInfo(animeResult.mal_id, parsed.episode);
                if (epInfo) {
                    result.episodeName = epInfo.title;
                }
            }
        }
    }

    // Determine if match is uncertain (no poster = likely wrong)
    const uncertain = !result?.posterUrl;

    const info = {
        title: result?.title || parsed.title,
        posterUrl: result?.posterUrl || null,
        season: parsed.season,
        episode: parsed.episode,
        episodeName: result?.episodeName || null,
        type: parsed.type,
        fromFolder: fromFolder,
        source: result ? source : 'none',
        uncertain: uncertain
    };

    // Log the result with source info
    if (result) {
        log.info(`INFO: ${source.toUpperCase()} found: "${info.title}"${info.posterUrl ? ' (with poster)' : ' (NO POSTER - uncertain)'}`);
    } else {
        log.warn(`WARN: No API match found for "${parsed.title}" - using filename as-is`);
    }

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

    // Get media info (use cache first, fetch in background for new files)
    let mediaInfo = mediaCache[filename] || null;

    if (state !== '-1' && state !== '0' && !mediaInfo) {
        // For new files, kick off API fetch but don't block
        getMediaInfo(filename, filepath).then(info => {
            // Will be used on next poll
        }).catch(err => {
            log.error('ERROR:', err.message);
        });
    }

    // Build display strings (Plex-style layout)
    let displayTitle = mediaInfo?.title || filename.replace(/\.[^/.]+$/, '') || mpcFork;
    let displayState = '';

    if (mediaInfo?.type === 'tv' && mediaInfo.season && mediaInfo.episode) {
        displayState = `S${mediaInfo.season} • E${mediaInfo.episode}`;
        if (mediaInfo.episodeName) {
            displayState += ` - ${mediaInfo.episodeName}`;
        }
    }
    // Ensure state is never empty - Discord requires non-empty fields
    displayState = displayState.trimStr(128) || `${position} / ${duration}` || 'Playing';

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
        // PAUSED - show position/duration for movies
        if (!mediaInfo?.type || mediaInfo.type !== 'tv') {
            payload.state = position && duration ? `${position} / ${duration}` : 'Paused';
        }
    } else if (state === '2') {
        // PLAYING - show position/duration for movies, use timestamps
        if (!mediaInfo?.type || mediaInfo.type !== 'tv') {
            payload.state = position && duration ? `${position} / ${duration}` : 'Playing';
        }

        // Add timestamps for live progress bar
        if (position && duration) {
            const positionMs = toSeconds(position) * 1000;
            const durationMs = toSeconds(duration) * 1000;
            const now = Date.now();

            payload.timestamps = {
                start: now - positionMs,
                end: now + (durationMs - positionMs)
            };
        }
    }

    // Final safeguard - state must never be empty
    if (!payload.state || payload.state.trim() === '') {
        payload.state = states[state]?.string || 'Playing';
    }

    payload.status_display_type = 1;

    // Send update when state, filename changes, or we have media info
    const shouldUpdate = (state !== playback.prevState) ||
        (filename !== playback.prevFilename) ||
        (mediaInfo && !playback.prevMediaInfo);

    if (shouldUpdate) {
        rpc.setActivity(payload);
        log.info(`INFO: ${states[state].string} - ${displayTitle} - ${displayState}`);
        playback.prevMediaInfo = !!mediaInfo;
    }

    // Save previous state
    playback.prevState = state;
    playback.prevPosition = position;
    // Reset media info flag when file changes
    if (filename !== playback.prevFilename) {
        playback.prevMediaInfo = false;
    }
    playback.prevFilename = filename;

    return true;
};

module.exports = updatePresence;
