import {
  DOCUMENTS_DIR,
  FOLDERS_DIR,
  isAllowedPath,
  LOCK_PATH,
  MANIFEST_PATH,
  parseEntryPath,
  serialize,
  type LockFile,
  type Manifest,
} from "./format";

export const LOCK_STALE_MS = 2 * 60 * 1000;

export class SyncLockedError extends Error {
  constructor(readonly otherDeviceId: string, readonly lockedAt: number) {
    super(
      "Outra instância do Arcane Node está sincronizando esta pasta agora. Aguarde até 2 minutos e tente novamente.",
    );
    this.name = "SyncLockedError";
  }
}

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

export class ForbiddenPathError extends Error {
  constructor(path: string) {
    super(`Escrita fora da área permitida bloqueada: ${path}`);
    this.name = "ForbiddenPathError";
  }
}

/** What the engine knows about the folder before the first link. */
export type FolderInspection = "empty" | "arcane" | "foreign" | "invalid-manifest";

/**
 * Storage-agnostic access to the synced folder.
 * Paths are always POSIX-style and relative to the linked folder root.
 */
export interface FileAdapter {
  isAvailable(): boolean;
  /** Raw manifest text, or `null` if missing. */
  readManifest(): Promise<string | null>;
  writeManifest(manifest: Manifest): Promise<void>;
  /** Raw entry text, or `null` if missing. */
  readEntry(path: string): Promise<string | null>;
  writeEntry(path: string, data: string): Promise<void>;
  deleteEntry(path: string): Promise<void>;
  /**
   * Lists entry files under `lore/` (extension to the base contract: lets the engine
   * recover entries when `manifest.json` is missing or stale).
   */
  listEntryPaths(): Promise<string[]>;
  /** True if the folder has no user-visible files at all. */
  isEmpty(): Promise<boolean>;
  acquireLock(deviceId: string, now?: number): Promise<void>;
  releaseLock(deviceId: string): Promise<void>;
}

/** Shared logic (path whitelist, lock protocol) on top of a few raw primitives. */
export abstract class BaseFileAdapter implements FileAdapter {
  protected abstract readText(path: string): Promise<string | null>;
  protected abstract writeText(path: string, data: string): Promise<void>;
  protected abstract removeFile(path: string): Promise<void>;
  /** File names (not paths) directly inside `dir`; empty if the dir doesn't exist. */
  protected abstract listFiles(dir: string): Promise<string[]>;
  abstract isEmpty(): Promise<boolean>;
  abstract isAvailable(): boolean;

  private guard(path: string): void {
    if (!isAllowedPath(path)) throw new ForbiddenPathError(path);
  }

  readManifest(): Promise<string | null> {
    return this.readText(MANIFEST_PATH);
  }

  async writeManifest(manifest: Manifest): Promise<void> {
    await this.writeText(MANIFEST_PATH, serialize(manifest));
  }

  readEntry(path: string): Promise<string | null> {
    this.guard(path);
    return this.readText(path);
  }

  async writeEntry(path: string, data: string): Promise<void> {
    this.guard(path);
    if (!path.startsWith("lore/")) throw new ForbiddenPathError(path);
    await this.writeText(path, data);
  }

  async deleteEntry(path: string): Promise<void> {
    this.guard(path);
    if (!path.startsWith("lore/")) throw new ForbiddenPathError(path);
    await this.removeFile(path);
  }

  async listEntryPaths(): Promise<string[]> {
    const result: string[] = [];
    for (const dir of [FOLDERS_DIR, DOCUMENTS_DIR]) {
      for (const name of await this.listFiles(dir)) {
        const path = `${dir}/${name}`;
        if (parseEntryPath(path)) result.push(path);
      }
    }
    return result;
  }

  async acquireLock(deviceId: string, now: number = Date.now()): Promise<void> {
    const raw = await this.readText(LOCK_PATH);
    if (raw !== null) {
      try {
        const lock = JSON.parse(raw) as Partial<LockFile>;
        if (
          typeof lock.deviceId === "string" &&
          typeof lock.timestamp === "number" &&
          lock.deviceId !== deviceId &&
          now - lock.timestamp < LOCK_STALE_MS
        ) {
          throw new SyncLockedError(lock.deviceId, lock.timestamp);
        }
      } catch (err) {
        if (err instanceof SyncLockedError) throw err;
        // Unreadable lock file: treat as stale.
      }
    }
    const lock: LockFile = { deviceId, timestamp: now };
    await this.writeText(LOCK_PATH, serialize(lock));
  }

  async releaseLock(deviceId: string): Promise<void> {
    const raw = await this.readText(LOCK_PATH);
    if (raw === null) return;
    try {
      const lock = JSON.parse(raw) as Partial<LockFile>;
      if (lock.deviceId !== deviceId) return; // never remove someone else's lock
    } catch {
      // Corrupt lock written by us or nobody: safe to remove.
    }
    await this.removeFile(LOCK_PATH);
  }
}
