/**
 * MPC-DiscordRPC - Discord Rich Presence for Media Player Classic
 * Shows "Watching TV" with media info, poster, and progress bar
 */

const log = require('fancy-log');
log.info('INFO: Loading...');

const axios = require('axios').default,
	DiscordIPC = require('./discordIPC'),
	updatePresence = require('./core'),
	events = require('events'),
	config = require('./config'),
	tmdb = require('./tmdbClient');

// Discord Application ID (hardcoded for "Watching" display)
const clientId = '1466028230380224718';

// Initialize TMDB client (uses hardcoded Read Access Token)
tmdb.init();
log.info('INFO: TMDB API initialized');

let mediaEmitter = new events.EventEmitter(),
	active = false,
	discordRPCLoop,
	mpcServerLoop,
	discord = null,
	isReconnecting = false;

// Validate MPC port
if (isNaN(config.port)) {
	throw new Error('Port is empty or invalid! Please set a valid port number in config.js');
}

const uri = `http://127.0.0.1:${config.port}/variables.html`;

log.info('INFO: Trying to connect to Discord...');

// Connected to MPC - poll every 5 seconds
mediaEmitter.on('CONNECTED', async res => {
	clearInterval(mpcServerLoop);
	mpcServerLoop = setInterval(checkMPCEndpoint, 5000);
	if (!active) {
		log.info(`INFO: Connected to ${res.headers.server}`);
	}
	active = await updatePresence(res, discord);
});

// MPC disconnected - retry every 15 seconds
mediaEmitter.on('CONN_ERROR', () => {
	if (active) {
		log.warn('WARN: MPC disconnected. Waiting...');
	}
	active = false;
	clearInterval(mpcServerLoop);
	mpcServerLoop = setInterval(checkMPCEndpoint, 15000);
});

// Discord connected - start MPC polling
mediaEmitter.on('discordConnected', () => {
	clearInterval(discordRPCLoop);
	isReconnecting = false;
	log.info('INFO: Connected to Discord. Listening on ' + uri);
	checkMPCEndpoint();
	mpcServerLoop = setInterval(checkMPCEndpoint, 15000);
});

// Discord disconnected - stop polling, reconnect
mediaEmitter.on('discordDisconnected', () => {
	clearInterval(mpcServerLoop);
	active = false;
	if (!isReconnecting) {
		isReconnecting = true;
		log.warn('WARN: Discord disconnected. Reconnecting...');
		setTimeout(initDiscord, 5000);
	}
});

// Check MPC Web Interface
function checkMPCEndpoint() {
	axios.get(uri)
		.then(res => mediaEmitter.emit('CONNECTED', res))
		.catch(() => mediaEmitter.emit('CONN_ERROR'));
}

// Initialize Discord IPC connection
async function initDiscord() {
	if (discord && discord.isReady()) return;

	discord = new DiscordIPC(clientId);
	discord.on('ready', () => mediaEmitter.emit('discordConnected'));
	discord.on('disconnected', () => mediaEmitter.emit('discordDisconnected'));

	try {
		await discord.connect();
	} catch (err) {
		if (!isReconnecting) {
			log.warn('WARN: Discord not available. Retrying...');
			isReconnecting = true;
		}
		discord = null;
	}
}

// Start
initDiscord();
discordRPCLoop = setInterval(() => {
	if (!discord || !discord.isReady()) initDiscord();
}, 10000);

// Graceful shutdown
process.on('SIGINT', () => {
	log.info('INFO: Shutting down...');
	if (discord) discord.close();
	process.exit(0);
});
