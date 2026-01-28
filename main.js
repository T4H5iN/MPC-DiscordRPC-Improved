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
    const { nativeImage } = require('electron');

    // Simple 16x16 green circle icon (PNG base64)
    const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABfSURBVDiNY/j//z8DDjByL4z+zwABjMQowGYAMwMDA8P/f/8Y/v/7x8DAwMjAwMDIiNUAZgYGBgZmJkYGBiYmRgYmJuyCWL3AzMTEwMjExMDIyIjdAFJdQBEgxQAilgEAD6UUEy7qpIIAAAAASUVORK5CYII=';

    try {
        let icon = nativeImage.createFromDataURL(iconData);
        icon = icon.resize({ width: 16, height: 16 });

        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: () => {
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
            { type: 'separator' },
            {
                label: 'Exit',
                click: () => {
                    app.isQuiting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('MPC Discord RPC');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        });

        console.log('Tray initialized successfully');
    } catch (err) {
        console.error('Tray setup failed:', err);
    }
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
