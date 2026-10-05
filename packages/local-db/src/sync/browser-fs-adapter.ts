import { BaseFileAdapter } from "./file-adapter";

// File System Access API pieces that are not (yet) in TypeScript's lib.dom.
type PermissionMode = "read" | "readwrite";
interface PermissionCapableHandle {
  queryPermission?(descriptor: { mode: PermissionMode }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: PermissionMode }): Promise<PermissionState>;
}
interface IterableDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
}
interface DirectoryPickerWindow {
  showDirectoryPicker?(options?: { id?: string; mode?: PermissionMode; startIn?: string }): Promise<FileSystemDirectoryHandle>;
}

const IGNORED_SYSTEM_FILES = new Set(["desktop.ini", "thumbs.db", ".ds_store"]);

export type FsErrorKind = "aborted" | "not-allowed" | "not-found" | "unknown";

/** Classifies File System Access errors. `aborted` = user cancelled (not an error). */
export function classifyFsError(err: unknown): FsErrorKind {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "AbortError") return "aborted";
  if (name === "NotAllowedError" || name === "SecurityError") return "not-allowed";
  if (name === "NotFoundError" || name === "TypeMismatchError") return "not-found";
  return "unknown";
}

export function isFsAccessSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

export type PickResult =
  | { status: "picked"; handle: FileSystemDirectoryHandle }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function pickDirectory(): Promise<PickResult> {
  const w = window as DirectoryPickerWindow;
  if (!w.showDirectoryPicker) return { status: "error", message: "Navegador sem suporte a seleção de pastas." };
  try {
    const handle = await w.showDirectoryPicker({ id: "arcane-node-sync", mode: "readwrite", startIn: "documents" });
    return { status: "picked", handle };
  } catch (err) {
    const kind = classifyFsError(err);
    if (kind === "aborted") return { status: "cancelled" };
    if (kind === "not-allowed") return { status: "error", message: "Permissão negada para acessar a pasta." };
    return { status: "error", message: err instanceof Error ? err.message : "Falha ao abrir o seletor de pastas." };
  }
}

export async function queryDirPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  try {
    const h = handle as unknown as PermissionCapableHandle;
    return h.queryPermission ? await h.queryPermission({ mode: "readwrite" }) : "prompt";
  } catch {
    return "prompt";
  }
}

/** Must be called from a user gesture (click). */
export async function requestDirPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  try {
    const h = handle as unknown as PermissionCapableHandle;
    return h.requestPermission ? await h.requestPermission({ mode: "readwrite" }) : "denied";
  } catch (err) {
    const kind = classifyFsError(err);
    if (kind === "aborted" || kind === "not-allowed") return "denied";
    return "denied";
  }
}

/** FileAdapter backed by a `FileSystemDirectoryHandle` (Chromium browsers). */
export class BrowserFsAdapter extends BaseFileAdapter {
  constructor(private readonly root: FileSystemDirectoryHandle) {
    super();
  }

  isAvailable(): boolean {
    return isFsAccessSupported();
  }

  async isEmpty(): Promise<boolean> {
    try {
      for await (const entry of (this.root as unknown as IterableDirectoryHandle).values()) {
        if (!IGNORED_SYSTEM_FILES.has(entry.name.toLowerCase())) return false;
      }
      return true;
    } catch (err) {
      throw this.wrap(err, "listar a pasta");
    }
  }

  private split(path: string): { dirs: string[]; file: string } {
    const parts = path.split("/");
    const file = parts.pop() ?? "";
    return { dirs: parts, file };
  }

  private async resolveDir(dirs: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
    let current = this.root;
    for (const segment of dirs) {
      try {
        current = await current.getDirectoryHandle(segment, { create });
      } catch (err) {
        if (!create && classifyFsError(err) === "not-found") return null;
        throw err;
      }
    }
    return current;
  }

  protected async readText(path: string): Promise<string | null> {
    try {
      const { dirs, file } = this.split(path);
      const dir = await this.resolveDir(dirs, false);
      if (!dir) return null;
      const fileHandle = await dir.getFileHandle(file);
      return await (await fileHandle.getFile()).text();
    } catch (err) {
      if (classifyFsError(err) === "not-found") return null;
      throw this.wrap(err, `ler ${path}`);
    }
  }

  protected async writeText(path: string, data: string): Promise<void> {
    try {
      const { dirs, file } = this.split(path);
      const dir = await this.resolveDir(dirs, true);
      if (!dir) throw new Error(`Diretório inacessível para ${path}`);
      const fileHandle = await dir.getFileHandle(file, { create: true });
      // createWritable writes to a swap file and commits on close (atomic replace).
      const writable = await fileHandle.createWritable();
      try {
        await writable.write(data);
        await writable.close();
      } catch (err) {
        await writable.abort().catch(() => undefined);
        throw err;
      }
    } catch (err) {
      throw this.wrap(err, `gravar ${path}`);
    }
  }

  protected async removeFile(path: string): Promise<void> {
    try {
      const { dirs, file } = this.split(path);
      const dir = await this.resolveDir(dirs, false);
      if (!dir) return;
      await dir.removeEntry(file);
    } catch (err) {
      if (classifyFsError(err) === "not-found") return;
      throw this.wrap(err, `remover ${path}`);
    }
  }

  protected async listFiles(dirPath: string): Promise<string[]> {
    try {
      const dir = await this.resolveDir(dirPath.split("/"), false);
      if (!dir) return [];
      const names: string[] = [];
      for await (const entry of (dir as unknown as IterableDirectoryHandle).values()) {
        if (entry.kind === "file") names.push(entry.name);
      }
      return names;
    } catch (err) {
      if (classifyFsError(err) === "not-found") return [];
      throw this.wrap(err, `listar ${dirPath}`);
    }
  }

  private wrap(err: unknown, action: string): Error {
    if (classifyFsError(err) === "not-allowed") {
      return new Error(`Sem permissão para ${action}. Reconecte a pasta nas Configurações.`);
    }
    return new Error(`Falha ao ${action}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
