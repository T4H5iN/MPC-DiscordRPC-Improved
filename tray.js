/**
 * MPC Discord RPC - System Tray Application
 * Runs the Discord RPC service in the background with a system tray icon
 */

require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const SysTray = require('systray2').default;

// Path to the icon (base64 encoded for portability)
// This is a simple "play" icon - you can replace with your own
const ICON_BASE64 = 'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABMLAAATCwAAAAAAAAAAAAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////ANra2jHa2tqy2tra/9ra2v/a2tr/2tra/9ra2v/a2tr/2tra/9ra2rLa2toxAAAAAAAAAAAA////ANra2jHa2tqy2tra/8fHx/+np6f/p6en/6enp/+np6f/x8fH/9ra2v/a2tqy2traMQAAAAAAAAAAAP///wDa2tqy2tra/6enp/+np6f/7du1/+3btf/t27X/7du1/6enp/+np6f/2tra/9ra2rIAAAAAAAAAAAD///8A2tra/6enp/+np6f/p6en/+3btf/t27X/7du1/+3btf+np6f/p6en/6enp//a2tr/AAAAAAAAAAD///8A2tra/8fHx/+np6f/p6en/+3btf/t27X/7du1/+3btf+np6f/p6en/8fHx//a2tr/AAAAAAAAAAD///8A2tra/9ra2v+np6f/p6en/+3btf/t27X/7du1/+3btf+np6f/p6en/9ra2v/a2tr/AAAAAAAAAAD///8A2tra/9ra2v/Hx8f/p6en/+3btf/t27X/7du1/+3btf+np6f/x8fH/9ra2v/a2tr/AAAAAAAAAAD///8A2tra/9ra2v/a2tr/p6en/+3btf/t27X/7du1/+3btf+np6f/2tra/9ra2v/a2tr/AAAAAAAAAAD///8A2tra/9ra2v/a2tr/x8fH/+3btf/t27X/7du1/+3btf/Hx8f/2tra/9ra2v/a2tr/AAAAAAAAAAD///8A2trassra2v/a2tr/2tra/+3btf/t27X/7du1/+3btf/a2tr/2tra/9ra2v/a2tqyAAAAAAAAAAAA////ANra2jHa2tqy2tra/9ra2v/t27X/7du1/+3btf/t27X/2tra/9ra2v/a2tqy2traMQAAAAAAAAAAAP///wD///8A2traMdra2rLa2tr/7du1/+3btf/t27X/7du1/9ra2v/a2tqy2traMQAAAAAAAAAAAAD///8A////AP///wD///8A2traMdra2rLa2tr/2tra/9ra2v/a2tr/2tra2tra2jEAAAAAAAAAAAAA////AP///wD///8A////AP///wD///8A2traMdra2rLa2tqy2trassra2jEAAAAAAAAAAAAAAAAAAAAA////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A//8AAP//AADAAwAAgAEAAIABAACAAQAAgAEAAIABAACAAQAAgAEAAIABAACAAQAAgAEAAMADAAD//wAA//8AAA==';

let mainProcess = null;
let isRunning = false;
let systray = null;

/**
 * Start the main MPC-DiscordRPC process
 */
function startService() {
    if (isRunning) return;

    const scriptPath = path.join(__dirname, 'index.js');

    mainProcess = spawn('node', [scriptPath], {
        cwd: __dirname,
        stdio: 'pipe',
        windowsHide: true
    });

    mainProcess.stdout.on('data', (data) => {
        console.log(`[RPC] ${data.toString().trim()}`);
    });

    mainProcess.stderr.on('data', (data) => {
        console.error(`[RPC Error] ${data.toString().trim()}`);
    });

    mainProcess.on('exit', (code) => {
        console.log(`[RPC] Process exited with code ${code}`);
        isRunning = false;
        updateTrayMenu();
    });

    isRunning = true;
    console.log('[Tray] MPC-DiscordRPC service started');
    updateTrayMenu();
}

/**
 * Stop the main process
 */
function stopService() {
    if (!isRunning || !mainProcess) return;

    mainProcess.kill();
    mainProcess = null;
    isRunning = false;
    console.log('[Tray] MPC-DiscordRPC service stopped');
    updateTrayMenu();
}

/**
 * Toggle the service on/off
 */
function toggleService() {
    if (isRunning) {
        stopService();
    } else {
        startService();
    }
}

/**
 * Update the tray menu items
 */
function updateTrayMenu() {
    if (!systray) return;

    // Update the status item
    systray.sendAction({
        type: 'update-item',
        item: {
            title: isRunning ? '● Running' : '○ Stopped',
            enabled: false
        },
        seq_id: 0
    });

    // Update toggle item
    systray.sendAction({
        type: 'update-item',
        item: {
            title: isRunning ? 'Stop Service' : 'Start Service',
            enabled: true
        },
        seq_id: 1
    });
}

/**
 * Create and show the system tray
 */
function createTray() {
    systray = new SysTray({
        menu: {
            icon: ICON_BASE64,
            title: 'MPC Discord RPC',
            tooltip: 'MPC Discord Rich Presence',
            items: [
                {
                    title: isRunning ? '● Running' : '○ Stopped',
                    enabled: false
                },
                {
                    title: 'Start Service',
                    enabled: true
                },
                {
                    title: 'Open Config',
                    enabled: true
                },
                SysTray.separator,
                {
                    title: 'Exit',
                    enabled: true
                }
            ]
        },
        debug: false,
        copyDir: true
    });

    systray.onClick(action => {
        switch (action.seq_id) {
            case 1: // Start/Stop Service
                toggleService();
                break;
            case 2: // Open Config
                const configPath = path.join(__dirname, 'config.js');
                const { exec } = require('child_process');
                exec(`notepad "${configPath}"`);
                break;
            case 4: // Exit
                stopService();
                systray.kill(false);
                break;
        }
    });

    console.log('[Tray] System tray created');
}

// Main entry point
console.log('[Tray] MPC Discord RPC - System Tray Mode');
console.log('[Tray] Starting service automatically...');

createTray();
startService();

// Handle process termination
process.on('SIGINT', () => {
    stopService();
    if (systray) systray.kill(false);
    process.exit(0);
});

process.on('SIGTERM', () => {
    stopService();
    if (systray) systray.kill(false);
    process.exit(0);
});
