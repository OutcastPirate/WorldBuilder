// Exposes file saving to the Angular app (window.worldBuilderDesktop).
// The page runs with contextIsolation, so this is its only access to the
// file system: every save goes through a native dialog in the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('worldBuilderDesktop', {
  // { defaultName, filters, data: ArrayBuffer | string } -> saved path or null
  saveFile: (options) => ipcRenderer.invoke('world-builder:save-file', options),
  // { folderName, files: [{ name, data }] } -> saved folder path or null
  saveFiles: (options) => ipcRenderer.invoke('world-builder:save-files', options),
});
