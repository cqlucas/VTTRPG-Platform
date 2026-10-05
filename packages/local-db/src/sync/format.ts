import { CURRENT_ENTRY_SCHEMA_VERSION, type LoreDocument, type LoreFolder, type RichTextNode } from "../schema";
import { isSafeId } from "../utils";
import type { LoreEntryKind } from "../lore-repository";

// ──────────────────────────────────────────────
// On-disk layout
// ──────────────────────────────────────────────

export const APP_ID = "arcane-node";
export const MANIFEST_SCHEMA_VERSION = 1;
export const MANIFEST_PATH = "manifest.json";
export const LOCK_PATH = ".arcane-sync.lock";
export const FOLDERS_DIR = "lore/folders";
export const DOCUMENTS_DIR = "lore/documents";

export interface ManifestEntry {
  id: string;
  kind: LoreEntryKind;
  path: string;
  revision: number;
  updatedAt: number;
  hash: string;
  deleted: boolean;
}

export interface Manifest {
  appId: typeof APP_ID;
  schemaVersion: number;
  updatedAt: number;
  entries: ManifestEntry[];
}

export interface FolderFile {
  schemaVersion: number;
  id: string;
  parentId: string | null;
  name: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  deletedAt?: number;
}

export interface DocumentFile {
  schemaVersion: number;
  id: string;
  folderId: string | null;
  title: string;
  content: RichTextNode;
  revision: number;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  deletedAt?: number;
}

export interface LockFile {
  deviceId: string;
  timestamp: number;
}

/** Only these paths may ever be written inside the user's folder. */
export function isAllowedPath(path: string): boolean {
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  return path === MANIFEST_PATH || path === LOCK_PATH || path.startsWith("lore/");
}

export function entryPath(kind: LoreEntryKind, id: string): string {
  return `${kind === "folder" ? FOLDERS_DIR : DOCUMENTS_DIR}/${id}.json`;
}

export function parseEntryPath(path: string): { kind: LoreEntryKind; id: string } | null {
  const match = /^lore\/(folders|documents)\/([^/]+)\.json$/.exec(path);
  if (!match || !isSafeId(match[2])) return null;
  return { kind: match[1] === "folders" ? "folder" : "document", id: match[2] };
}

/** Human-readable JSON (2-space indentation). */
export function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// ──────────────────────────────────────────────
// Parsing / validation
// ──────────────────────────────────────────────

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNullableStr = (v: unknown): v is string | null => v === null || typeof v === "string";

function parseJson(raw: string): ParseResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (err) {
    return { ok: false, error: `JSON inválido (${err instanceof Error ? err.message : String(err)})` };
  }
}

export function parseManifest(raw: string): ParseResult<Manifest> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (!isRec(v) || v.appId !== APP_ID) return { ok: false, error: "manifest.json não pertence ao Arcane Node" };
  if (!isNum(v.schemaVersion)) return { ok: false, error: "manifest.json sem schemaVersion" };
  if (v.schemaVersion > MANIFEST_SCHEMA_VERSION) {
    return { ok: false, error: `manifest.json usa uma versão mais nova (${v.schemaVersion}); atualize o app` };
  }
  if (!Array.isArray(v.entries)) return { ok: false, error: "manifest.json sem lista de entradas" };
  const entries: ManifestEntry[] = [];
  for (const e of v.entries) {
    if (
      isRec(e) &&
      typeof e.id === "string" &&
      isSafeId(e.id) &&
      (e.kind === "document" || e.kind === "folder") &&
      isNum(e.revision) &&
      typeof e.hash === "string"
    ) {
      entries.push({
        id: e.id,
        kind: e.kind,
        path: entryPath(e.kind, e.id),
        revision: e.revision,
        updatedAt: isNum(e.updatedAt) ? e.updatedAt : 0,
        hash: e.hash,
        deleted: e.deleted === true,
      });
    }
  }
  return {
    ok: true,
    value: { appId: APP_ID, schemaVersion: v.schemaVersion, updatedAt: isNum(v.updatedAt) ? v.updatedAt : 0, entries },
  };
}

function parseCommon(v: Rec, expectedId: string): ParseResult<null> {
  if (v.id !== expectedId) return { ok: false, error: "id do arquivo não corresponde ao nome do arquivo" };
  if (!isNum(v.schemaVersion)) return { ok: false, error: "schemaVersion ausente" };
  if (v.schemaVersion > CURRENT_ENTRY_SCHEMA_VERSION) {
    return { ok: false, error: `versão de formato mais nova (${v.schemaVersion}); atualize o app` };
  }
  if (!isNum(v.revision) || !isNum(v.createdAt) || !isNum(v.updatedAt)) {
    return { ok: false, error: "revision/createdAt/updatedAt inválidos" };
  }
  if (typeof v.deleted !== "boolean") return { ok: false, error: "campo deleted inválido" };
  return { ok: true, value: null };
}

export function parseFolderFile(raw: string, expectedId: string): ParseResult<FolderFile> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (!isRec(v)) return { ok: false, error: "conteúdo não é um objeto" };
  const common = parseCommon(v, expectedId);
  if (!common.ok) return common;
  if (typeof v.name !== "string" || !isNullableStr(v.parentId)) return { ok: false, error: "name/parentId inválidos" };
  return {
    ok: true,
    value: {
      schemaVersion: v.schemaVersion as number,
      id: expectedId,
      parentId: v.parentId,
      name: v.name,
      revision: v.revision as number,
      createdAt: v.createdAt as number,
      updatedAt: v.updatedAt as number,
      deleted: v.deleted as boolean,
      ...(isNum(v.deletedAt) ? { deletedAt: v.deletedAt } : {}),
    },
  };
}

export function parseDocumentFile(raw: string, expectedId: string): ParseResult<DocumentFile> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (!isRec(v)) return { ok: false, error: "conteúdo não é um objeto" };
  const common = parseCommon(v, expectedId);
  if (!common.ok) return common;
  if (typeof v.title !== "string" || !isNullableStr(v.folderId)) return { ok: false, error: "title/folderId inválidos" };
  if (!isRec(v.content)) return { ok: false, error: "content inválido" };
  return {
    ok: true,
    value: {
      schemaVersion: v.schemaVersion as number,
      id: expectedId,
      folderId: v.folderId,
      title: v.title,
      content: v.content as RichTextNode,
      revision: v.revision as number,
      createdAt: v.createdAt as number,
      updatedAt: v.updatedAt as number,
      deleted: v.deleted as boolean,
      ...(isNum(v.deletedAt) ? { deletedAt: v.deletedAt } : {}),
    },
  };
}

// ──────────────────────────────────────────────
// Local <-> file conversion
// ──────────────────────────────────────────────

export function folderToFile(f: LoreFolder): FolderFile {
  return {
    schemaVersion: CURRENT_ENTRY_SCHEMA_VERSION,
    id: f.id,
    parentId: f.parentId,
    name: f.name,
    revision: f.revision,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    deleted: f.deleted,
    ...(f.deleted && f.deletedAt !== undefined ? { deletedAt: f.deletedAt } : {}),
  };
}

export function documentToFile(d: Pick<LoreDocument, "id" | "folderId" | "title" | "content" | "revision" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">): DocumentFile {
  return {
    schemaVersion: CURRENT_ENTRY_SCHEMA_VERSION,
    id: d.id,
    folderId: d.folderId,
    title: d.title,
    content: d.content,
    revision: d.revision,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    deleted: d.deleted,
    ...(d.deleted && d.deletedAt !== undefined ? { deletedAt: d.deletedAt } : {}),
  };
}

export function fileToFolder(f: FolderFile): LoreFolder {
  return {
    id: f.id,
    type: "lore",
    campaignId: null,
    parentId: f.parentId,
    name: f.name,
    sortOrder: 0,
    revision: f.revision,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    deleted: f.deleted,
    ...(f.deleted && f.deletedAt !== undefined ? { deletedAt: f.deletedAt } : {}),
    schemaVersion: CURRENT_ENTRY_SCHEMA_VERSION,
  };
}
