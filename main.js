const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const RPCManager = require('./rpcManager');

app.disableHardwareAcceleration();

const store = new Store();
let mainWindow;
let rpcManager;
let tray;

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
        startRpcManager();

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
        icon: path.join(__dirname, 'assets/icon.ico')
    });

    mainWindow.loadFile('src/index.html');

    mainWindow.on('close', async (event) => {
        if (app.isQuiting) return;

        event.preventDefault();

        const closeAction = store.get('closeAction');

        if (closeAction === 'minimize') {
            if (!tray) setupTray();
            mainWindow.hide();
        } else if (closeAction === 'exit') {
            app.isQuiting = true;
            app.quit();
        } else {
            const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['Minimize to Tray', 'Exit App', 'Cancel'],
                defaultId: 0,
                cancelId: 2,
                title: 'Close Action',
                message: 'Do you want to minimize to the system tray or exit the application?',
                checkboxLabel: 'Remember my choice',
            });

            if (response === 2) return;

            if (checkboxChecked) {
                store.set('closeAction', response === 0 ? 'minimize' : 'exit');
            }

            if (response === 0) {
                if (!tray) setupTray();
                mainWindow.hide();
            } else {
                app.isQuiting = true;
                app.quit();
            }
        }
    });
}

function startRpcManager() {
    rpcManager = new RPCManager();

    rpcManager.on('log', (msg) => {
        if (mainWindow) {
            mainWindow.webContents.send('rpc-log', msg);

            const isUncertain = msg.includes('NO POSTER - uncertain') || msg.includes('No API match found');

            if (msg.includes('Watching -')) {
                const details = msg.split('Watching - ')[1]?.split(' - ')[0];
                mainWindow.webContents.send('rpc-status', {
                    state: 'Watching',
                    details: details,
                    uncertain: isUncertain
                });
            } else if (msg.includes('Paused -')) {
                const details = msg.split('Paused - ')[1]?.split(' - ')[0];
                mainWindow.webContents.send('rpc-status', {
                    state: 'Paused',
                    details: details,
                    uncertain: isUncertain
                });
            } else if (msg.includes('Idle')) {
                mainWindow.webContents.send('rpc-status', { state: 'Idle', details: 'Waiting for media...', uncertain: false });
            }
        }
    });

    rpcManager.start();
}

function setupTray() {
    if (tray) return;

    const { nativeImage } = require('electron');

    try {
        const iconPath = path.join(__dirname, 'assets', 'icon.png');
        let icon = nativeImage.createFromPath(iconPath);
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

ipcMain.on('reset-close-action', () => {
    store.delete('closeAction');
});

ipcMain.on('save-title-override', (event, data) => {
    const overrides = store.get('titleOverrides', {});
    overrides[data.folderPath] = data.correctTitle;
    store.set('titleOverrides', overrides);
    console.log(`Saved override: "${data.folderPath}" -> "${data.correctTitle}"`);
    event.reply('title-override-saved', true);
});

ipcMain.on('get-title-overrides', (event) => {
    event.reply('title-overrides', store.get('titleOverrides', {}));
});

ipcMain.on('delete-title-override', (event, folderPath) => {
    const overrides = store.get('titleOverrides', {});
    delete overrides[folderPath];
    store.set('titleOverrides', overrides);
    event.reply('title-override-deleted', true);
});

autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-msg', 'Update available!');
});
autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-msg', 'No updates available.');
});
autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-msg', 'Update error: ' + err);
});
autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-msg', 'Update downloaded. Restarting...');
    setTimeout(() => autoUpdater.quitAndInstall(), 3000);
});

app.on('before-quit', () => {
    app.isQuiting = true;
    if (rpcManager) rpcManager.stop();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
