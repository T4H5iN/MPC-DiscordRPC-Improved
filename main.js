const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

const store = new Store();
let mainWindow;
let rpcWorker;
let tray;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        startRpcWorker();
        setupTray();

        // Auto-launch check
        if (store.get('autoLaunch', false)) {
            app.setLoginItemSettings({ openAtLogin: true });
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true,
        backgroundColor: '#1a1b1e',
        icon: path.join(__dirname, 'assets/icon.ico') // Will fallback if missing
    });

    mainWindow.loadFile('src/index.html');

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

function startRpcWorker() {
    // Fork the existing index.js as a background process
    rpcWorker = fork(path.join(__dirname, 'index.js'), [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    rpcWorker.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        console.log(`[RPC] ${msg}`);
        if (mainWindow) {
            mainWindow.webContents.send('rpc-log', msg);

            // Parse status for simple display
            if (msg.includes('Watching -')) {
                mainWindow.webContents.send('rpc-status', { state: 'Watching', details: msg.split('Watching - ')[1] });
            } else if (msg.includes('Paused -')) {
                mainWindow.webContents.send('rpc-status', { state: 'Paused', details: msg.split('Paused - ')[1] });
            } else if (msg.includes('Idle')) {
                mainWindow.webContents.send('rpc-status', { state: 'Idle', details: 'Waiting for media...' });
            }
        }
    });

    rpcWorker.stderr.on('data', (data) => {
        console.error(`[RPC Error] ${data.toString()}`);
    });
}

function setupTray() {
    // Base64 icon fallback or file
    // For now try to load valid icon or use default
    // tray = new Tray(...) 
    // Skipping complex tray logic for now, using Window hide/show behavior
}

// IPC Handlers
ipcMain.on('toggle-startup', (event, enable) => {
    store.set('autoLaunch', enable);
    app.setLoginItemSettings({ openAtLogin: enable });
});

ipcMain.on('get-startup', (event) => {
    event.reply('get-startup-reply', store.get('autoLaunch', false));
});

ipcMain.on('check-update', () => {
    autoUpdater.checkForUpdatesAndNotify();
});

// Update events
autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-msg', 'Update available!');
});
autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-msg', 'Update downloaded. Restarting...');
    setTimeout(() => autoUpdater.quitAndInstall(), 3000);
});

app.on('before-quit', () => {
    app.isQuiting = true;
    if (rpcWorker) rpcWorker.kill();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
