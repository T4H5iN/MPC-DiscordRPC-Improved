/**
 * Jikan API Client (MyAnimeList Wrapper)
 * Free API - No authentication required
 * Rate limit: 3 requests/second, 60 requests/minute
 */

const axios = require('axios');
const log = require('fancy-log');

const JIKAN_BASE = 'https://api.jikan.moe/v4';

// Simple cache to avoid repeated API calls
const cache = {};

/**
 * Search for anime by title
 * @param {string} title - Anime title to search
 * @returns {Object|null} - Anime info with title and poster
 */
async function searchAnime(title) {
    if (!title || title.trim().length < 2) return null;

    const cacheKey = title.toLowerCase().trim();
    if (cache[cacheKey]) {
        log.info(`INFO: Jikan cache hit for "${title}"`);
        return cache[cacheKey];
    }

    try {
        log.info(`INFO: Jikan API searching: "${title}"`);

        const response = await axios.get(`${JIKAN_BASE}/anime`, {
            params: {
                q: title,
                limit: 5,
                sfw: true
            },
            timeout: 8000
        });

        if (!response.data?.data || response.data.data.length === 0) {
            log.warn(`WARN: Jikan found no results for "${title}"`);
            return null;
        }

        // Find best match (prefer exact or close title match)
        const results = response.data.data;
        let bestMatch = results[0];

        const titleLower = title.toLowerCase();
        for (const anime of results) {
            // Check main title
            if (anime.title?.toLowerCase().includes(titleLower) ||
                titleLower.includes(anime.title?.toLowerCase())) {
                bestMatch = anime;
                break;
            }
            // Check alternative titles
            if (anime.title_english?.toLowerCase().includes(titleLower) ||
                anime.title_japanese?.toLowerCase().includes(titleLower)) {
                bestMatch = anime;
                break;
            }
        }

        const result = {
            title: bestMatch.title_english || bestMatch.title,
            japaneseTitle: bestMatch.title_japanese,
            posterUrl: bestMatch.images?.jpg?.large_image_url ||
                bestMatch.images?.jpg?.image_url || null,
            year: bestMatch.year || (bestMatch.aired?.from ? new Date(bestMatch.aired.from).getFullYear() : null),
            episodes: bestMatch.episodes,
            score: bestMatch.score,
            mal_id: bestMatch.mal_id,
            type: 'anime'
        };

        log.info(`INFO: Jikan found: "${result.title}" (${result.year || 'N/A'})`);

        cache[cacheKey] = result;
        return result;

    } catch (err) {
        if (err.response?.status === 429) {
            log.warn('WARN: Jikan rate limit hit, waiting...');
            // Wait 1 second and retry once
            await new Promise(r => setTimeout(r, 1000));
            return searchAnime(title);
        }
        log.error(`ERROR: Jikan API failed: ${err.message}`);
        return null;
    }
}

/**
 * Get anime episode info
 * @param {number} malId - MyAnimeList ID
 * @param {number} episodeNum - Episode number
 * @returns {Object|null} - Episode info
 */
async function getEpisodeInfo(malId, episodeNum) {
    if (!malId || !episodeNum) return null;

    try {
        const response = await axios.get(`${JIKAN_BASE}/anime/${malId}/episodes/${episodeNum}`, {
            timeout: 5000
        });

        if (response.data?.data) {
            return {
                title: response.data.data.title || response.data.data.title_romanji,
                titleJapanese: response.data.data.title_japanese
            };
        }
        return null;
    } catch (err) {
        // Episode info not found is common, don't log error
        return null;
    }
}

module.exports = {
    searchAnime,
    getEpisodeInfo
};
