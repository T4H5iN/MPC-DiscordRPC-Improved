/**
 * MPC-DiscordRPC Configuration
 */

// Port for MPC Web Interface (MPC Options > Web Interface)
exports.port = 13579;

// Clean up filenames (for fallback when TMDB doesn't find match)
exports.ignoreBrackets = true;    // Remove [text] from filename
exports.ignoreFiletype = false;   // Remove file extension
exports.replaceUnderscore = true; // Replace _ with space
exports.replaceDots = true;       // Replace . with space (except extension)