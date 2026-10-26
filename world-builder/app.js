const { app, BrowserWindow, dialog, ipcMain, net, protocol } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Automated tests set this to a folder: saves then go there without a
// dialog (a native dialog can't be driven remotely). Unset in normal use.
const AUTO_SAVE_DIR = process.env.WORLD_BUILDER_AUTO_SAVE_DIR;

// `electron . --dev` loads the Angular dev server, otherwise the built app.
const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:4200';
const DIST_DIR = path.join(__dirname, 'dist', 'world-builder', 'browser');

// Serving the build through a custom privileged scheme (instead of file://)
// keeps fetch() working for the three.js loaders and lets absolute paths
// like `/assets/...` resolve against the app root.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
    let filePath = path.normalize(path.join(DIST_DIR, relativePath));

    // Refuse anything that escapes the dist folder.
    if (!filePath.startsWith(DIST_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }
    // Unknown paths are Angular routes (e.g. /objectsMenu), so serve index.html.
    if (!path.extname(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function toBuffer(data) {
  return typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(new Uint8Array(data));
}

// Saves one file chosen in a Save dialog. Returns its path, or null if the
// user cancelled.
ipcMain.handle('world-builder:save-file', async (event, { defaultName, filters, data }) => {
  const name = path.basename(String(defaultName));
  let filePath = AUTO_SAVE_DIR && path.join(AUTO_SAVE_DIR, name);
  if (!filePath) {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(window, { defaultPath: name, filters });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }
  await fs.promises.writeFile(filePath, toBuffer(data));
  return filePath;
});

// Saves several files into a new folder inside the folder the user picks.
// Returns the new folder's path, or null if the user cancelled.
ipcMain.handle('world-builder:save-files', async (event, { folderName, files }) => {
  let parent = AUTO_SAVE_DIR;
  if (!parent) {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(window, {
      title: `Choose where to create the "${folderName}" folder`,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    parent = result.filePaths[0];
  }

  // Never overwrite an earlier export: add a number to the folder name.
  const base = path.basename(String(folderName));
  let folder = path.join(parent, base);
  for (let n = 2; fs.existsSync(folder); n++) folder = path.join(parent, `${base} (${n})`);
  await fs.promises.mkdir(folder, { recursive: true });

  for (const file of files) {
    // Only plain file names; nothing can be written outside the new folder.
    await fs.promises.writeFile(path.join(folder, path.basename(String(file.name))), toBuffer(file.data));
  }
  return folder;
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#202020',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(isDev ? DEV_URL : 'app://bundle/');

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!isDev) registerAppProtocol();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
