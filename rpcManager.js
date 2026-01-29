const log = require('fancy-log');
const axios = require('axios').default;
const DiscordIPC = require('./discordIPC');
const updatePresence = require('./core');
const events = require('events');
const config = require('./config');
const tmdb = require('./tmdbClient');
const clientId = '1466028230380224718';

class RPCManager extends events.EventEmitter {
    constructor() {
        super();
        this.active = false;
        this.discord = null;
        this.connecting = false;
        this.mpcServerLoop = null;
        this.discordRPCLoop = null;
        this.uri = `http://127.0.0.1:${config.port}/variables.html`;

        log.info = (msg, ...args) => {
            const formatted = this.formatMsg(msg, args);
            this.emit('log', formatted);
            console.log(`[RPC] ${formatted}`);
        };

        log.warn = (msg, ...args) => {
            const formatted = this.formatMsg(msg, args);
            this.emit('log', formatted);
            console.warn(`[RPC] ${formatted}`);
        };

        log.error = (msg, ...args) => {
            const formatted = this.formatMsg(msg, args);
            this.emit('log', formatted);
            console.error(`[RPC] ${formatted}`);
        };
    }

    formatMsg(msg, args) {
        if (args.length > 0) {
            return msg + ' ' + args.join(' ');
        }
        return msg;
    }

    log(level, msg) {
        if (level === 'info') log.info(msg);
        else if (level === 'warn') log.warn(msg);
        else if (level === 'error') log.error(msg);
    }

    start() {
        this.log('info', 'INFO: Loading...');
        tmdb.init();
        this.log('info', 'INFO: TMDB API initialized');

        if (isNaN(config.port)) {
            this.log('error', 'Port is empty or invalid! Please set a valid port number in config.js');
            return;
        }

        this.log('info', 'INFO: Trying to connect to Discord...');
        this.initDiscord();
        this.discordRPCLoop = setInterval(() => {
            if (!this.discord || !this.discord.isReady()) this.initDiscord();
        }, 10000);
    }

    stop() {
        this.log('info', 'INFO: Shutting down...');
        clearInterval(this.mpcServerLoop);
        clearInterval(this.discordRPCLoop);
        if (this.discord) this.discord.close();
        this.active = false;
    }

    checkMPCEndpoint() {
        axios.get(this.uri)
            .then(res => this.handleMPCConnect(res))
            .catch(() => this.handleMPCError());
    }

    async handleMPCConnect(res) {
        clearInterval(this.mpcServerLoop);
        this.mpcServerLoop = setInterval(() => this.checkMPCEndpoint(), 3000);

        if (!this.active) {
            this.log('info', `INFO: Connected to ${res.headers.server}`);
        }

        this.active = await updatePresence(res, this.discord);
    }

    handleMPCError() {
        if (this.active) {
            this.log('warn', 'WARN: MPC disconnected. Clearing presence...');
            if (this.discord && this.discord.isReady()) {
                this.discord.clearActivity();
            }
        }
        this.active = false;
        clearInterval(this.mpcServerLoop);
        this.mpcServerLoop = setInterval(() => this.checkMPCEndpoint(), 15000);
    }

    async initDiscord() {
        if (this.discord && this.discord.isReady()) return;
        if (this.connecting) return;

        this.connecting = true;

        try {
            this.discord = new DiscordIPC(clientId);

            this.discord.on('ready', () => {
                this.log('info', 'INFO: Connected to Discord. Listening on ' + this.uri);
                this.checkMPCEndpoint();

                if (this.mpcServerLoop) clearInterval(this.mpcServerLoop);
                this.mpcServerLoop = setInterval(() => this.checkMPCEndpoint(), 3000);
            });

            this.discord.on('disconnected', () => {
                if (this.mpcServerLoop) clearInterval(this.mpcServerLoop);
                this.mpcServerLoop = null;
                this.active = false;
                this.log('warn', 'WARN: Discord disconnected. Reconnecting...');
                this.discord = null;
            });

            await this.discord.connect();
        } catch (err) {
            this.log('warn', 'WARN: Discord not available. Retrying in background...');
            this.discord = null;
        } finally {
            this.connecting = false;
        }
    }
}

module.exports = RPCManager;
