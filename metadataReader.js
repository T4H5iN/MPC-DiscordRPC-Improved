/**
 * Video Metadata Reader
 * Extracts embedded tags from MKV/MP4 files
 */

const path = require('path');
const fs = require('fs');
const log = require('fancy-log');

// music-metadata is ESM-only, so we need dynamic import
let mm = null;

/**
 * Lazy load music-metadata (ESM module)
 */
async function loadMM() {
    if (!mm) {
        mm = await import('music-metadata');
    }
    return mm;
}

/**
 * Read metadata from a video file
 * @param {string} filePath - Full path to the video file
 * @returns {Object|null} Extracted metadata or null if not found
 */
async function readVideoMetadata(filePath) {
    try {
        const mmLib = await loadMM();
        const metadata = await mmLib.parseFile(filePath, { skipCovers: true });

        if (!metadata || !metadata.common) {
            return null;
        }

        const common = metadata.common;

        // MKV/MP4 can have various tags
        // Common ones: title, album (show name), track (episode number)
        const result = {
            title: common.title || null,
            show: common.album || common.tvShow || null,
            season: common.disk?.no || null,
            episode: common.track?.no || null,
            artist: common.artist || null,
            year: common.year || null,
            genre: common.genre?.[0] || null,
            raw: common
        };

        // Try to extract show name from various fields
        if (!result.show && common.artist) {
            result.show = common.artist;
        }

        if (!result.show && common.album) {
            result.show = common.album;
        }

        log.info(`INFO: Metadata found - Title: "${result.title}", Show: "${result.show}", S${result.season}E${result.episode}`);

        return result;
    } catch (err) {
        log.warn(`WARN: Could not read metadata: ${err.message}`);
        return null;
    }
}

/**
 * Check if file exists and is readable
 * @param {string} filePath 
 * @returns {boolean}
 */
function isReadable(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    readVideoMetadata,
    isReadable
};
