const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  });
}

function dataFile() {
  return path.join(app.getPath('userData'), 'daily-list-data.json');
}

ipcMain.on('data:load', (event) => {
  try {
    event.returnValue = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    event.returnValue = null;
  }
});

ipcMain.on('data:save', (event, data) => {
  try {
    const file = dataFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temp, file);
    event.returnValue = true;
  } catch (error) {
    console.error('Failed to save daily list:', error);
    event.returnValue = false;
  }
});

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 370,
    height: 650,
    x: width - 400,
    y: 48,
    minWidth: 320,
    minHeight: 88,
    maxWidth: 520,
    frame: false,
    transparent: true,
    resizable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: false,
    hasShadow: true,
    icon: path.join(__dirname, '..', 'assets', 'daily-list.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => win.show());
}

ipcMain.on('window:minimize', () => win?.minimize());
ipcMain.on('window:close', () => win?.close());
ipcMain.on('window:collapse', (_event, collapsed) => {
  if (!win) return;
  const [width] = win.getSize();
  win.setMinimumSize(320, collapsed ? 76 : 88);
  win.setSize(width, collapsed ? 76 : 650, true);
  win.setResizable(!collapsed);
});
ipcMain.handle('window:pin', (_event, pinned) => {
  win?.setAlwaysOnTop(pinned, 'floating');
  return pinned;
});

if (hasSingleInstanceLock) app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
