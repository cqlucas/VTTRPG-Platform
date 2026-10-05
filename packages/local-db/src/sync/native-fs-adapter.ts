import { NotImplementedError, type FileAdapter } from "./file-adapter";
import type { Manifest } from "./format";

const TODO_MESSAGE =
  "NativeFsAdapter ainda não foi implementado (aguardando a escolha entre Tauri e Electron).";

/**
 * STUB for the desktop build.
 *
 * TODO(desktop): implement once Tauri or Electron is chosen. Required work:
 *  - `pickFolder()` via the native dialog (Tauri `@tauri-apps/plugin-dialog` / Electron `dialog.showOpenDialog`)
 *    and persist the absolute path (no permission prompts on desktop).
 *  - Map the raw primitives to the native FS (Tauri `@tauri-apps/plugin-fs` or Electron `fs/promises`
 *    exposed through a preload bridge): readText, writeText (atomic: write tmp + rename), removeFile, listFiles, isEmpty.
 *  - Extend `BaseFileAdapter` so the path whitelist and the lock protocol are reused unchanged.
 *  - Restrict FS scope to the chosen folder (Tauri capabilities / Electron IPC validation).
 */
export class NativeFsAdapter implements FileAdapter {
  isAvailable(): boolean {
    return false;
  }

  /** Opens the native folder picker. */
  static async pickFolder(): Promise<NativeFsAdapter | null> {
    throw new NotImplementedError(TODO_MESSAGE);
  }

  readManifest(): Promise<string | null> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
  writeManifest(_manifest: Manifest): Promise<void> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
  readEntry(_path: string): Promise<string | null> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
  writeEntry(_path: string, _data: string): Promise<void> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
  deleteEntry(_path: string): Promise<void> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
  listEntryPaths(): Promise<string[]> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
  isEmpty(): Promise<boolean> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
  acquireLock(_deviceId: string): Promise<void> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
  releaseLock(_deviceId: string): Promise<void> {
    throw new NotImplementedError(TODO_MESSAGE);
  }
}
