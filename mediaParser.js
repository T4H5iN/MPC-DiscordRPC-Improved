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
    'HMAX', 'DSNP', 'ATVP', 'PCOK', 'HBO', 'HULU', 'BD',
    // Codec
    'x264', 'x265', 'H264', 'H.264', 'H265', 'H.265', 'HEVC', 'AVC', 'XviD', 'DivX',
    'AAC', 'AC3', 'DTS', 'FLAC', 'MP3', 'Atmos', 'TrueHD',
    // HDR
    'HDR', 'HDR10', 'HDR10Plus', 'DV', 'DoVi', 'Dolby Vision',
    // Other
    'REMUX', 'PROPER', 'REPACK', 'EXTENDED', 'UNRATED', 'DIRECTORS', 'THEATRICAL',
    '10bit', '8bit', 'Multi', 'Dual', 'Audio', 'Dual-Audio'
];

const REMOVE_PHRASES = [
    'The Complete Series',
    'Complete Series',
    'The Complete Collection',
    'Complete Collection',
    'Season Pack',
    'Complete Season',
    'Full Series',
    'All Episodes',
    'Complete',
    'Collection'
];

// Regex patterns for TV show episode detection
const TV_PATTERNS = [
    // S01E01 or S01E01E02 (multi-episode)
    /[.\s_-]?S(\d{1,2})[.\s_-]?E(\d{1,3})(?:E\d{1,3})?[.\s_-]?/i,
    // 1x01 format
    /[.\s_-](\d{1,2})x(\d{1,3})[.\s_-]?/i,
    // Season 1 Episode 1
    /Season[.\s_-]?(\d{1,2})[.\s_-]?Episode[.\s_-]?(\d{1,3})/i,
    // Anime format: "3rd Season - 03" (ordinal season, episode after dash)
    /\s+(\d{1,2})(?:st|nd|rd|th)\s+Season\s*-\s*(\d{1,3})(?:\s|$)/i,
    // Anime format: "Show S3 - 03" (season in title, episode after dash)
    /\s+S(\d{1,2})\s*-\s*(\d{1,3})(?:\s|$)/i,
    // E01 only (assume season 1)
    /[.\s_-]E(\d{1,3})[.\s_-]/i,
    // Anime format: " - 01" or " - 01v2" followed by quality/group info (SubsPlease, Erai-raws, etc)
    /\s+-\s*(\d{1,3})(?:v\d)?\s*(?:\(|\[|$)/i,
    // Anime format: "[01]" episode in brackets (at end or before quality)
    /\[(\d{1,3})\](?:\s*\(|\s*\[|$)/i,
];

// Year pattern (1900-2099)
const YEAR_PATTERN = /[.\s_(-]?((?:19|20)\d{2})[.\s_)-]?/;

/**
 * Parse a media filename to extract metadata
 * @param {string} filename - The filename to parse
 * @returns {Object} Parsed media info
 */
function parseFilename(filename) {
    let name = filename.replace(/\.[^/.]+$/, '');

    const original = name;

    let result = {
        title: '',
        year: null,
        season: null,
        episode: null,
        type: 'movie',
        originalFilename: filename
    };

    for (const pattern of TV_PATTERNS) {
        const match = name.match(pattern);
        if (match) {
            result.type = 'tv';
            if (match.length === 3) {
                result.season = parseInt(match[1], 10);
                result.episode = parseInt(match[2], 10);
            } else if (match.length === 2) {
                result.season = 1;
                result.episode = parseInt(match[1], 10);
            }
            name = name.substring(0, name.search(pattern));
            break;
        }
    }

    const yearMatch = name.match(YEAR_PATTERN);
    if (yearMatch) {
        result.year = parseInt(yearMatch[1], 10);
        const yearIndex = name.indexOf(yearMatch[0]);
        if (yearIndex > 0) {
            name = name.substring(0, yearIndex);
        }
    }

    for (const phrase of REMOVE_PHRASES) {
        const regex = new RegExp(`[\\s_-]*${phrase}[\\s_-]*`, 'gi');
        name = name.replace(regex, ' ');
    }

    for (const tag of QUALITY_TAGS) {
        const regex = new RegExp(`[.\\s_(-]${tag}(?:[.\\s_)-]|$)`, 'gi');
        name = name.replace(regex, ' ');
    }

    name = name.replace(/^\([^)]+\)\s*/, '');
    name = name.replace(/^\[[^\]]+\]\s*/, '');
    name = name.replace(/-[a-zA-Z0-9]+$/, '');
    name = name.replace(/\[[^\]]*\]/g, '');
    name = name.replace(/\([^)]*\)/g, '');
    name = name
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/-+/g, ' ')
        .replace(/^\s*-\s*/, '')
        .replace(/\s*-\s*$/, '')
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
