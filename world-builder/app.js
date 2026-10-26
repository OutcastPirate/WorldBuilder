const { app, BrowserWindow, net, protocol } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

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
