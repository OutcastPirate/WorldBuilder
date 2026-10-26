import { Injectable } from '@angular/core';

export type FileData = ArrayBuffer | Uint8Array | string;

export interface FileFilter {
  name: string;
  extensions: string[];
}

// Bridge provided by preload.js when running inside Electron.
interface DesktopBridge {
  saveFile(options: { defaultName: string; filters: FileFilter[]; data: ArrayBuffer | string }): Promise<string | null>;
  saveFiles(options: { folderName: string; files: { name: string; data: ArrayBuffer | string }[] }): Promise<string | null>;
}

declare global {
  interface Window {
    worldBuilderDesktop?: DesktopBridge;
  }
}

// Result of a save: where it went, or that the browser started a download,
// or that the user cancelled.
export type SaveResult =
  | { kind: 'saved'; path: string }
  | { kind: 'downloaded' }
  | { kind: 'cancelled' };

// Saves files with a native dialog in the desktop app, or as downloads when
// the app runs in a browser.
@Injectable({
  providedIn: 'root',
})
export class FileSaveService {
  async saveFile(defaultName: string, data: FileData, filters: FileFilter[] = []): Promise<SaveResult> {
    const desktop = window.worldBuilderDesktop;
    if (desktop) {
      const path = await desktop.saveFile({ defaultName, filters, data: toTransferable(data) });
      return path ? { kind: 'saved', path } : { kind: 'cancelled' };
    }
    this.download(defaultName, data);
    return { kind: 'downloaded' };
  }

  // Several files that belong together (e.g. OBJ + MTL + texture).
  async saveFiles(folderName: string, files: { name: string; data: FileData }[]): Promise<SaveResult> {
    const desktop = window.worldBuilderDesktop;
    if (desktop) {
      const path = await desktop.saveFiles({
        folderName,
        files: files.map((f) => ({ name: f.name, data: toTransferable(f.data) })),
      });
      return path ? { kind: 'saved', path } : { kind: 'cancelled' };
    }
    files.forEach((file) => this.download(file.name, file.data));
    return { kind: 'downloaded' };
  }

  private download(name: string, data: FileData): void {
    const url = URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

// IPC copies ArrayBuffers; a Uint8Array view is cut down to its own bytes.
function toTransferable(data: FileData): ArrayBuffer | string {
  if (typeof data === 'string' || data instanceof ArrayBuffer) return data;
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
