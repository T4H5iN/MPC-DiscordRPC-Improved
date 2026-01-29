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
const episodeCache = {};

/**
 * Extract season number from anime title
 * Handles: "2nd Season", "3rd Season", "Season 3", "S3", "Part 2", etc.
 * @param {string} title - Anime title
 * @returns {number|null} - Season number or null if not found/S1
 */
function extractSeasonFromTitle(title) {
    if (!title) return null;

    const patterns = [
        // "2nd Season", "3rd Season", "4th Season"
        /(\d+)(?:st|nd|rd|th)\s+Season/i,
        // "Season 2", "Season 3"
        /Season\s+(\d+)/i,
        // "S2", "S3" at word boundary
        /\bS(\d+)\b/i,
        // "Part 2", "Part 3" (some anime use this)
        /Part\s+(\d+)/i,
        // Roman numerals: II, III, IV (common in anime)
        /\b(II|III|IV|V|VI)\b/,
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            const value = match[1];
            // Handle Roman numerals
            const romanMap = { 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6 };
            if (romanMap[value]) return romanMap[value];
            return parseInt(value, 10);
        }
    }

    return null; // No season indicator = likely season 1
}

/**
 * Search for anime by title, optionally finding a specific season
 * @param {string} title - Anime title to search
 * @param {number|null} season - Optional season number to find
 * @returns {Object|null} - Anime info with title, poster, and mal_id
 */
async function searchAnime(title, season = null) {
    if (!title || title.trim().length < 2) return null;

    const cacheKey = `${title.toLowerCase().trim()}_s${season || 1}`;
    if (cache[cacheKey]) {
        log.info(`INFO: Jikan cache hit for "${title}" S${season || 1}`);
        return cache[cacheKey];
    }

    try {
        log.info(`INFO: Jikan API searching: "${title}"${season ? ` (looking for S${season})` : ''}`);

        const response = await axios.get(`${JIKAN_BASE}/anime`, {
            params: {
                q: title,
                limit: 15, // Get more results to find correct season
                sfw: true
            },
            timeout: 8000
        });

        if (!response.data?.data || response.data.data.length === 0) {
            log.warn(`WARN: Jikan found no results for "${title}"`);
            return null;
        }

        const results = response.data.data;
        const titleLower = title.toLowerCase();
        let bestMatch = null;

        // First pass: find entries that match the title
        const titleMatches = results.filter(anime => {
            const animeTitle = anime.title?.toLowerCase() || '';
            const englishTitle = anime.title_english?.toLowerCase() || '';

            // Check if the base title matches (ignoring season suffixes)
            const baseTitle = titleLower.replace(/\s*(s\d+|season\s*\d+|\d+(?:st|nd|rd|th)\s+season).*$/i, '').trim();

            return animeTitle.includes(baseTitle) ||
                englishTitle.includes(baseTitle) ||
                baseTitle.includes(animeTitle.replace(/[\[\]]/g, '').trim());
        });

        if (titleMatches.length === 0) {
            // Fall back to first result if no title matches
            titleMatches.push(results[0]);
        }

        // Second pass: find the correct season
        if (season && season > 1) {
            // Look for explicit season match
            for (const anime of titleMatches) {
                const animeSeason = extractSeasonFromTitle(anime.title) ||
                    extractSeasonFromTitle(anime.title_english);
                if (animeSeason === season) {
                    bestMatch = anime;
                    log.info(`INFO: Jikan found season ${season}: "${anime.title}"`);
                    break;
                }
            }
        }

        // If no season match found, use first title match (usually S1)
        if (!bestMatch) {
            // Prefer entries without season suffix for S1
            if (!season || season === 1) {
                bestMatch = titleMatches.find(anime => {
                    const s = extractSeasonFromTitle(anime.title) || extractSeasonFromTitle(anime.title_english);
                    return s === null || s === 1;
                }) || titleMatches[0];
            } else {
                bestMatch = titleMatches[0];
                log.warn(`WARN: Jikan couldn't find S${season}, using: "${bestMatch.title}"`);
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
            type: 'anime',
            detectedSeason: extractSeasonFromTitle(bestMatch.title) || extractSeasonFromTitle(bestMatch.title_english) || 1
        };

        log.info(`INFO: Jikan found: "${result.title}" (mal_id: ${result.mal_id})`);

        cache[cacheKey] = result;
        return result;

    } catch (err) {
        if (err.response?.status === 429) {
            log.warn('WARN: Jikan rate limit hit, waiting...');
            await new Promise(r => setTimeout(r, 1000));
            return searchAnime(title, season);
        }
        log.error(`ERROR: Jikan API failed: ${err.message}`);
        return null;
    }
}

/**
 * Get anime episode info
 * @param {number} malId - MyAnimeList ID (season-specific)
 * @param {number} episodeNum - Episode number within that season
 * @returns {Object|null} - Episode info
 */
async function getEpisodeInfo(malId, episodeNum) {
    if (!malId || !episodeNum) return null;

    const cacheKey = `${malId}_ep${episodeNum}`;
    if (episodeCache[cacheKey]) {
        return episodeCache[cacheKey];
    }

    try {
        // Fetch episode list (paginated, 100 per page)
        const response = await axios.get(`${JIKAN_BASE}/anime/${malId}/episodes`, {
            timeout: 5000
        });

        if (response.data?.data) {
            // Find the episode by mal_id (which is the episode number)
            const episode = response.data.data.find(ep => ep.mal_id === episodeNum);

            if (episode) {
                const result = {
                    title: episode.title || episode.title_romanji,
                    titleJapanese: episode.title_japanese
                };
                episodeCache[cacheKey] = result;
                log.info(`INFO: Jikan found episode ${episodeNum}: "${result.title}"`);
                return result;
            }
        }
        return null;
    } catch (err) {
        // Episode info not found is common, don't log error
        return null;
    }
}

module.exports = {
    searchAnime,
    getEpisodeInfo,
    extractSeasonFromTitle
};
