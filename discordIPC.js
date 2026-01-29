/**
 * Custom Discord IPC Client
 * Direct communication with Discord via IPC to support activity type (Watching)
 * Based on Discord's Rich Presence protocol
 */

const net = require('net');
const EventEmitter = require('events');
const log = require('fancy-log');

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;
const OP_PING = 3;
const OP_PONG = 4;

function generateNonce() {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

function getIPCPath(id = 0) {
    if (process.platform === 'win32') {
        return `\\\\?\\pipe\\discord-ipc-${id}`;
    }

    const { env: { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } } = process;
    const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
    return `${prefix.replace(/\/$/, '')}/discord-ipc-${id}`;
}

function encode(opcode, data) {
    const jsonStr = JSON.stringify(data);
    const len = Buffer.byteLength(jsonStr);
    const packet = Buffer.alloc(8 + len);
    packet.writeInt32LE(opcode, 0);
    packet.writeInt32LE(len, 4);
    packet.write(jsonStr, 8);
    return packet;
}

function decode(buffer) {
    const opcode = buffer.readInt32LE(0);
    const len = buffer.readInt32LE(4);
    const data = JSON.parse(buffer.slice(8, 8 + len).toString());
    return { opcode, data };
}

class DiscordIPC extends EventEmitter {
    constructor(clientId) {
        super();
        this.clientId = clientId;
        this.socket = null;
        this.connected = false;
        this.ready = false;
        this.buffer = Buffer.alloc(0);
        this.reconnectTimer = null;
        this.isReconnecting = false;
    }

    /**
     * Connect to Discord IPC
     */
    async connect() {
        if (this.connected) return;

        for (let i = 0; i < 10; i++) {
            try {
                await this._tryConnect(i);
                return;
            } catch (err) {
                // Try next socket
            }
        }

        throw new Error('Could not connect to Discord. Is Discord running?');
    }

    _tryConnect(socketId) {
        return new Promise((resolve, reject) => {
            const ipcPath = getIPCPath(socketId);
            const socket = net.createConnection(ipcPath);

            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error('Connection timeout'));
            }, 5000);

            socket.once('connect', () => {
                clearTimeout(timeout);
                this.socket = socket;
                this.connected = true;
                this._setupSocket();
                this._sendHandshake();
                resolve();
            });

            socket.once('error', (err) => {
                clearTimeout(timeout);
                socket.destroy();
                reject(err);
            });
        });
    }

    _setupSocket() {
        this.socket.on('data', (chunk) => {
            this.buffer = Buffer.concat([this.buffer, chunk]);
            this._processBuffer();
        });

        this.socket.on('close', () => {
            this.connected = false;
            this.ready = false;
            this.emit('disconnected');

            if (!this.isReconnecting) {
                this.isReconnecting = true;
                this.reconnectTimer = setTimeout(() => {
                    this.isReconnecting = false;
                    this.connect().catch(() => { });
                }, 5000);
            }
        });

        this.socket.on('error', (err) => {
            log.error('Discord IPC error:', err.message);
        });
    }

    _processBuffer() {
        while (this.buffer.length >= 8) {
            const length = this.buffer.readInt32LE(4);
            if (this.buffer.length < 8 + length) break;

            const packet = this.buffer.slice(0, 8 + length);
            this.buffer = this.buffer.slice(8 + length);

            try {
                const { opcode, data } = decode(packet);
                this._handleMessage(opcode, data);
            } catch (err) {
                log.error('Failed to decode Discord message:', err.message);
            }
        }
    }

    _handleMessage(opcode, data) {
        switch (opcode) {
            case OP_FRAME:
                if (data.evt === 'READY') {
                    this.ready = true;
                    this.user = data.data?.user;
                    this.emit('ready');
                    log.info('INFO: Discord IPC connected (Watching mode enabled)');
                } else if (data.evt === 'ERROR') {
                    log.error('Discord error:', data.data?.message);
                }
                break;
            case OP_CLOSE:
                this.close();
                break;
            case OP_PONG:
                break;
        }
    }

    _sendHandshake() {
        const handshake = {
            v: 1,
            client_id: this.clientId
        };
        this._send(OP_HANDSHAKE, handshake);
    }

    _send(opcode, data) {
        if (!this.socket || !this.connected) return false;

        try {
            this.socket.write(encode(opcode, data));
            return true;
        } catch (err) {
            log.error('Failed to send to Discord:', err.message);
            return false;
        }
    }

    /**
     * Set activity with full control including type
     * @param {Object} activity - Activity object
     * @param {number} activity.type - 0=Playing, 1=Streaming, 2=Listening, 3=Watching
     * @param {string} activity.details - First line of text
     * @param {string} activity.state - Second line of text
     * @param {Object} activity.timestamps - Start/end timestamps
     * @param {Object} activity.assets - Image keys and text
     * @param {Array} activity.buttons - Array of {label, url} objects
     */
    setActivity(activity) {
        if (!this.ready) {
            log.warn('Discord IPC not ready, activity not sent');
            return false;
        }

        const nonce = generateNonce();

        const activityPayload = {
            type: activity.type ?? 3,
            state: activity.state,
            details: activity.details,
            instance: true
        };

        if (typeof activity.status_display_type === 'number') {
            activityPayload.status_display_type = activity.status_display_type;
        }

        if (activity.timestamps) {
            activityPayload.timestamps = {};
            if (activity.timestamps.start) {
                activityPayload.timestamps.start = Math.floor(activity.timestamps.start);
            }
            if (activity.timestamps.end) {
                activityPayload.timestamps.end = Math.floor(activity.timestamps.end);
            }
        }

        if (activity.assets) {
            activityPayload.assets = {};
            if (activity.assets.large_image) {
                activityPayload.assets.large_image = activity.assets.large_image;
            }
            if (activity.assets.large_text) {
                activityPayload.assets.large_text = activity.assets.large_text;
            }
            if (activity.assets.small_image) {
                activityPayload.assets.small_image = activity.assets.small_image;
            }
            if (activity.assets.small_text) {
                activityPayload.assets.small_text = activity.assets.small_text;
            }
        }

        if (activity.buttons && activity.buttons.length > 0) {
            activityPayload.buttons = activity.buttons.slice(0, 2);
        }

        const payload = {
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: activityPayload
            },
            nonce: nonce
        };

        return this._send(OP_FRAME, payload);
    }

    /**
     * Clear current activity
     */
    clearActivity() {
        if (!this.ready) return false;

        const nonce = generateNonce();
        const payload = {
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: null
            },
            nonce: nonce
        };

        return this._send(OP_FRAME, payload);
    }

    /**
     * Close connection
     */
    close() {
        this.ready = false;
        this.connected = false;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
    }

    /**
     * Check if connected and ready
     */
    isReady() {
        return this.connected && this.ready;
    }
}

module.exports = DiscordIPC;
