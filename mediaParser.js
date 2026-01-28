/**
 * Media Filename Parser
 * Extracts title, year, season, episode from media filenames
 */

// Common quality/release tags to remove from filenames
const QUALITY_TAGS = [
    // Video quality
    '2160p', '1080p', '720p', '480p', '4K', 'UHD', 'HD', 'SD',
    // Source
    'BluRay', 'Blu-Ray', 'BDRip', 'BRRip', 'DVDRip', 'HDRip', 'WEB-DL', 'WEBDL',
    'WEBRip', 'WEB', 'HDTV', 'PDTV', 'DVDScr', 'CAM', 'TS', 'TC', 'AMZN', 'NF',
    'HMAX', 'DSNP', 'ATVP', 'PCOK', 'HBO', 'HULU',
    // Codec
    'x264', 'x265', 'H264', 'H.264', 'H265', 'H.265', 'HEVC', 'AVC', 'XviD', 'DivX',
    'AAC', 'AC3', 'DTS', 'FLAC', 'MP3', 'Atmos', 'TrueHD',
    // HDR
    'HDR', 'HDR10', 'HDR10Plus', 'DV', 'DoVi', 'Dolby Vision',
    // Other
    'REMUX', 'PROPER', 'REPACK', 'EXTENDED', 'UNRATED', 'DIRECTORS', 'THEATRICAL',
    '10bit', '8bit', 'Multi', 'Dual', 'Audio'
];

// Regex patterns for TV show episode detection
const TV_PATTERNS = [
    // S01E01 or S01E01E02 (multi-episode)
    /[.\s_-]?S(\d{1,2})[.\s_-]?E(\d{1,3})(?:E\d{1,3})?[.\s_-]?/i,
    // 1x01 format
    /[.\s_-](\d{1,2})x(\d{1,3})[.\s_-]?/i,
    // Season 1 Episode 1
    /Season[.\s_-]?(\d{1,2})[.\s_-]?Episode[.\s_-]?(\d{1,3})/i,
    // E01 only (assume season 1)
    /[.\s_-]E(\d{1,3})[.\s_-]/i,
];

// Year pattern (1900-2099)
const YEAR_PATTERN = /[.\s_(-]?((?:19|20)\d{2})[.\s_)-]?/;

/**
 * Parse a media filename to extract metadata
 * @param {string} filename - The filename to parse
 * @returns {Object} Parsed media info
 */
function parseFilename(filename) {
    // Remove file extension
    let name = filename.replace(/\.[^/.]+$/, '');

    // Store original for fallback
    const original = name;

    let result = {
        title: '',
        year: null,
        season: null,
        episode: null,
        type: 'movie', // 'movie' or 'tv'
        originalFilename: filename
    };

    // Try to detect TV show patterns
    for (const pattern of TV_PATTERNS) {
        const match = name.match(pattern);
        if (match) {
            result.type = 'tv';
            if (match.length === 3) {
                result.season = parseInt(match[1], 10);
                result.episode = parseInt(match[2], 10);
            } else if (match.length === 2) {
                // E01 only pattern
                result.season = 1;
                result.episode = parseInt(match[1], 10);
            }
            // Get title from before the pattern
            name = name.substring(0, name.search(pattern));
            break;
        }
    }

    // Extract year
    const yearMatch = name.match(YEAR_PATTERN);
    if (yearMatch) {
        result.year = parseInt(yearMatch[1], 10);
        // Only use text before year as title
        const yearIndex = name.indexOf(yearMatch[0]);
        if (yearIndex > 0) {
            name = name.substring(0, yearIndex);
        }
    }

    // Remove quality tags (case insensitive)
    for (const tag of QUALITY_TAGS) {
        const regex = new RegExp(`[.\\s_-]${tag}(?:[.\\s_-]|$)`, 'gi');
        name = name.replace(regex, ' ');
    }

    // Remove release group (usually at the end after a dash)
    name = name.replace(/-[a-zA-Z0-9]+$/, '');

    // Remove brackets and their content (like [SubGroup] or (2024))
    name = name.replace(/\[[^\]]*\]/g, '');
    name = name.replace(/\([^)]*\)/g, '');

    // Clean up: replace dots/underscores with spaces, trim
    name = name
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/-+/g, ' ')
        .trim();

    result.title = name || original;

    return result;
}

/**
 * Format episode string like "S02E07"
 * @param {number} season 
 * @param {number} episode 
 * @returns {string}
 */
function formatEpisode(season, episode) {
    if (season === null || episode === null) return null;
    const s = String(season).padStart(2, '0');
    const e = String(episode).padStart(2, '0');
    return `S${s}E${e}`;
}

module.exports = {
    parseFilename,
    formatEpisode
};
