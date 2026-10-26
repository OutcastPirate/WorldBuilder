// Starts Electron with the given arguments (e.g. `--dev`).
// ELECTRON_RUN_AS_NODE is removed first: VS Code sets it for processes started
// from its integrated terminal / extensions, and it makes Electron run as plain
// Node.js (require('electron') then has no app/BrowserWindow).
const { spawn } = require('child_process');
const path = require('path');
const electronBinary = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(
  electronBinary,
  [path.join(__dirname, '..'), ...process.argv.slice(2)],
  { stdio: 'inherit', env }
);

child.on('close', (code) => process.exit(code ?? 0));
