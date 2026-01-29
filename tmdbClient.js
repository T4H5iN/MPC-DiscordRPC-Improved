/**
 * TMDB API Client
 * Fetches movie/TV show metadata and poster images from The Movie Database
 */

const axios = require('axios').default;
const fs = require('fs');
const path = require('path');
const log = require('fancy-log');
const CACHE_FILE = path.join(__dirname, '.tmdb-cache.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2OTZhNGZmMmY3Y2JlMjMzMDA5Yjg4NWZlZDEyNjljZiIsIm5iZiI6MTYxNTY0NzcwNy40MTI5OTk5LCJzdWIiOiI2MDRjZDNkYmFlMjgxMTAwNTRiNjY5NmEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.B7YeezwBVoNI8VnzACnnbNTPlARDhcxET5uoNS3HybY';

let accessToken = null;
let cache = {};

/**
 * Initialize the TMDB client
 * @param {string} token - TMDB API Read Access Token (optional, uses default if not provided)
 */
function init(token = null) {
    accessToken = token || DEFAULT_ACCESS_TOKEN;
    loadCache();
}

/**
 * Load cache from disk
 */
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            cache = JSON.parse(data);
            const now = Date.now();
            for (const key of Object.keys(cache)) {
                if (now - cache[key].timestamp > CACHE_DURATION) {
                    delete cache[key];
                }
            }
        }
    } catch (err) {
        log.warn('WARN: Could not load TMDB cache:', err.message);
        cache = {};
    }
}

/**
 * Save cache to disk
 */
function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (err) {
        log.warn('WARN: Could not save TMDB cache:', err.message);
    }
}

/**
 * Get cached result or null if not found/expired
 * @param {string} key - Cache key
 * @returns {Object|null}
 */
function getCached(key) {
    const entry = cache[key];
    if (entry && (Date.now() - entry.timestamp < CACHE_DURATION)) {
        return entry.data;
    }
    return null;
}

/**
 * Set cache entry
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 */
function setCache(key, data) {
    cache[key] = {
        timestamp: Date.now(),
        data: data
    };
    saveCache();
}

/**
 * Search for a movie by title and optional year
 * @param {string} title - Movie title
 * @param {number|null} year - Release year (optional)
 * @returns {Promise<Object|null>}
 */
async function searchMovie(title, year = null) {
    if (!accessToken) {
        init();
    }

    const cacheKey = `movie:${title}:${year || ''}`;
    const cached = getCached(cacheKey);
    if (cached) {
        log.info('INFO: TMDB cache hit for', title);
        return cached;
    }

    try {
        const params = {
            query: title,
            include_adult: false
        };
        if (year) params.year = year;

        const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
            params,
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (response.data.results && response.data.results.length > 0) {
            const movie = response.data.results[0];
            const result = {
                id: movie.id,
                tmdbId: movie.id,
                type: 'movie',
                title: movie.title,
                year: movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null,
                posterPath: movie.poster_path,
                posterUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
                overview: movie.overview,
                rating: movie.vote_average
            };
            setCache(cacheKey, result);
            log.info('INFO: TMDB found movie:', result.title);
            return result;
        }
    } catch (err) {
        log.error('ERROR: TMDB movie search failed:', err.message);
    }

    return null;
}

/**
 * Search for a TV show by title and optional year
 * @param {string} title - TV show title
 * @param {number|null} year - First air year (optional)
 * @returns {Promise<Object|null>}
 */
async function searchTV(title, year = null) {
    if (!accessToken) {
        init();
    }

    const cacheKey = `tv:${title}:${year || ''}`;
    const cached = getCached(cacheKey);
    if (cached) {
        log.info('INFO: TMDB cache hit for', title);
        return cached;
    }

    try {
        const params = {
            query: title,
            include_adult: false
        };
        if (year) params.first_air_date_year = year;

        const response = await axios.get(`${TMDB_BASE_URL}/search/tv`, {
            params,
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (response.data.results && response.data.results.length > 0) {
            const show = response.data.results[0];
            const result = {
                id: show.id,
                tmdbId: show.id,
                type: 'tv',
                title: show.name,
                year: show.first_air_date ? parseInt(show.first_air_date.substring(0, 4)) : null,
                posterPath: show.poster_path,
                posterUrl: show.poster_path ? `${TMDB_IMAGE_BASE}${show.poster_path}` : null,
                overview: show.overview,
                rating: show.vote_average
            };
            setCache(cacheKey, result);
            log.info('INFO: TMDB found TV show:', result.title);
            return result;
        }
    } catch (err) {
        log.error('ERROR: TMDB TV search failed:', err.message);
    }

    return null;
}

/**
 * Get episode details for a TV show
 * @param {number} tvId - TMDB TV show ID
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @returns {Promise<Object|null>}
 */
async function getEpisode(tvId, season, episode) {
    if (!accessToken) {
        init();
    }

    const cacheKey = `episode:${tvId}:${season}:${episode}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const response = await axios.get(
            `${TMDB_BASE_URL}/tv/${tvId}/season/${season}/episode/${episode}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        const ep = response.data;
        const result = {
            name: ep.name,
            overview: ep.overview,
            airDate: ep.air_date,
            stillPath: ep.still_path,
            stillUrl: ep.still_path ? `${TMDB_IMAGE_BASE}${ep.still_path}` : null,
            rating: ep.vote_average
        };
        setCache(cacheKey, result);
        log.info('INFO: TMDB found episode:', result.name);
        return result;
    } catch (err) {
        log.error('ERROR: TMDB episode lookup failed:', err.message);
    }

    return null;
}

/**
 * Search for media (auto-detects movie vs TV)
 * @param {Object} parsedMedia - Parsed media info from mediaParser
 * @returns {Promise<Object|null>}
 */
async function searchMedia(parsedMedia) {
    const { title, year, season, episode, type } = parsedMedia;

    let result = null;

    if (type === 'tv') {
        result = await searchTV(title, year);
        if (result && season && episode) {
            const episodeInfo = await getEpisode(result.id, season, episode);
            if (episodeInfo) {
                result.episodeName = episodeInfo.name;
                result.episodeStillUrl = episodeInfo.stillUrl;
            }
        }
    } else {
        result = await searchMovie(title, year);
    }

    return result;
}

module.exports = {
    init,
    searchMovie,
    searchTV,
    getEpisode,
    searchMedia
};
