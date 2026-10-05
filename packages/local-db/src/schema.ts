import Dexie, { type EntityTable, type Transaction } from "dexie";

// ──────────────────────────────────────────────
// Rich text (structurally compatible with Tiptap's JSONContent)
// ──────────────────────────────────────────────

export interface RichTextMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichTextNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
}

// ──────────────────────────────────────────────
// Sync metadata shared by every synchronizable entity
// ──────────────────────────────────────────────

export const CURRENT_ENTRY_SCHEMA_VERSION = 1;

export interface SyncMeta {
  id: string;
  /** Incremented on every local change. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  /** Tombstone flag: entries are never physically removed. */
  deleted: boolean;
  deletedAt?: number;
  schemaVersion: number;
}

// ──────────────────────────────────────────────
// Local Database Interfaces
// ──────────────────────────────────────────────

export interface LocalCampaignData {
  id: string; // Synced with server Campaign ID
  name: string;
  gameSystem: string;
  lastAccessed: number;
  settings: Record<string, unknown>;
}

export interface LocalCharacter {
  id: string;
  campaignId: string;
  folderId?: string;
  name: string;
  portraitAssetId?: string;
  level: number;
  className?: string;
  race?: string;
  hitPointsMax: number;
  hitPointsCurrent: number;
  attributes: Record<string, number>;
  inventory: unknown[];
  features: string[];
  notes?: string;
  isNpc: boolean;
  ownerId: string; // Link to user ID
  createdAt: number;
  updatedAt: number;
}

export type FolderType = "character" | "lore" | "map";

/** Generic folder (shared by characters, lore and maps). Only `type: "lore"` is synced for now. */
export interface LocalFolder extends SyncMeta {
  /** `null` = library-wide (not bound to a campaign). */
  campaignId?: string | null;
  parentId: string | null;
  name: string;
  type: FolderType;
  sortOrder: number;
}

export type LoreFolder = LocalFolder & { type: "lore" };

/** A lore document (stored in the `loreNodes` table). */
export interface LoreDocument extends SyncMeta {
  campaignId?: string | null;
  folderId: string | null;
  title: string;
  /** Tiptap JSON document. */
  content: RichTextNode;
  /** Derived from `content`; used for future search. Never written to disk. */
  plainText: string;
  nodeType: string;
  // Legacy (v1) optional fields, preserved but unused by the compendium UI.
  coverAssetId?: string;
  isSecret?: boolean;
  tags?: string[];
  authorId?: string;
}

export interface LocalAsset {
  id: string;
  campaignId: string;
  name: string;
  mimeType: string;
  size: number;
  data: Blob | ArrayBuffer;
  createdAt: number;
}

export type FieldType = "text" | "int" | "float" | "calculated";

export interface SheetField {
  id: string; // unique internal ID, e.g. "str"
  label: string; // Display label
  type: FieldType;
  formula?: string; // Expression for calculated fields
  readonlyId?: boolean; // If true, the ID cannot be edited (used for PDF imports)
}

export interface SheetGroup {
  id: string;
  title?: string; // Optional title for the group
  width?: 1 | 2 | 3; // Number of columns this group occupies (max 3)
  fields: SheetField[];
}

export interface SheetTab {
  id: string;
  name: string;
  groups: SheetGroup[];
}

export interface SheetTemplate extends SyncMeta {
  campaignId?: string | null;
  title: string;
  description: string;
  tabs: SheetTab[];
}

/** Link between this browser profile and a folder on the user's disk. */
export interface SyncLink {
  id: "default";
  /** Structured-cloneable handle (File System Access API). `undefined` for non-browser adapters. */
  dirHandle?: FileSystemDirectoryHandle;
  dirName: string;
  deviceId: string;
  lastSyncAt?: number;
}

/** State of an entry at the end of the last successful sync (three-way merge base). */
export interface SyncBaseline {
  entryId: string;
  revision: number;
  hash: string;
}

export interface KeyValue {
  key: string;
  value: unknown;
}

// ──────────────────────────────────────────────
// Dexie Database Class
// ──────────────────────────────────────────────

export const LOCAL_DB_NAME = "QuestDreamerLocalDB";

export class QuestDreamerLocalDB extends Dexie {
  campaigns!: EntityTable<LocalCampaignData, "id">;
  characters!: EntityTable<LocalCharacter, "id">;
  folders!: EntityTable<LocalFolder, "id">;
  loreNodes!: EntityTable<LoreDocument, "id">;
  assets!: EntityTable<LocalAsset, "id">;
  sheetTemplates!: EntityTable<SheetTemplate, "id">;
  syncLinks!: EntityTable<SyncLink, "id">;
  syncBaselines!: EntityTable<SyncBaseline, "entryId">;
  kv!: EntityTable<KeyValue, "key">;

  constructor(name: string = LOCAL_DB_NAME) {
    super(name);

    this.version(1).stores({
      campaigns: "id", // Primary key is id
      characters: "id, campaignId, folderId, ownerId", // Indexed fields
      folders: "id, campaignId, parentId, type",
      loreNodes: "id, campaignId, folderId, authorId, nodeType",
      assets: "id, campaignId, mimeType",
    });

    // v2: sync metadata on folders/loreNodes + sync bookkeeping tables.
    // Non-destructive: existing rows are enriched, never dropped.
    this.version(2)
      .stores({
        campaigns: "id",
        characters: "id, campaignId, folderId, ownerId",
        folders: "id, campaignId, parentId, type",
        loreNodes: "id, campaignId, folderId, authorId, nodeType",
        assets: "id, campaignId, mimeType",
        syncLinks: "id",
        syncBaselines: "entryId",
        kv: "key",
      })
      .upgrade(migrateToV2);

    this.version(3)
      .stores({
        campaigns: "id",
        characters: "id, campaignId, folderId, ownerId",
        folders: "id, campaignId, parentId, type",
        loreNodes: "id, campaignId, folderId, authorId, nodeType",
        assets: "id, campaignId, mimeType",
        sheetTemplates: "id, campaignId",
        syncLinks: "id",
        syncBaselines: "entryId",
        kv: "key",
      });
  }
}

/** Converts legacy v1 rows to the v2 shape without losing any field. */
async function migrateToV2(tx: Transaction): Promise<void> {
  const now = Date.now();

  await tx
    .table("folders")
    .toCollection()
    .modify((row: Record<string, unknown>) => {
      row.parentId = typeof row.parentId === "string" ? row.parentId : null;
      row.revision = typeof row.revision === "number" ? row.revision : 1;
      row.createdAt = typeof row.createdAt === "number" ? row.createdAt : now;
      row.updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : now;
      row.deleted = row.deleted === true;
      row.schemaVersion = CURRENT_ENTRY_SCHEMA_VERSION;
      row.sortOrder = typeof row.sortOrder === "number" ? row.sortOrder : 0;
      if (typeof row.name !== "string") row.name = "Pasta";
      if (typeof row.type !== "string") row.type = "lore";
    });

  await tx
    .table("loreNodes")
    .toCollection()
    .modify((row: Record<string, unknown>) => {
      if (typeof row.content === "string") {
        const legacyText = row.content;
        // Preserve the original text verbatim as a backup field.
        row.legacyContent = legacyText;
        row.content = textToDoc(legacyText);
      } else if (!row.content || typeof row.content !== "object") {
        row.content = { type: "doc", content: [{ type: "paragraph" }] };
      }
      row.plainText = extractPlainText(row.content as RichTextNode);
      row.folderId = typeof row.folderId === "string" ? row.folderId : null;
      row.revision = typeof row.revision === "number" ? row.revision : 1;
      row.createdAt = typeof row.createdAt === "number" ? row.createdAt : now;
      row.updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : now;
      row.deleted = row.deleted === true;
      row.schemaVersion = CURRENT_ENTRY_SCHEMA_VERSION;
      if (typeof row.title !== "string") row.title = "Sem título";
      if (typeof row.nodeType !== "string") row.nodeType = "document";
    });
}

// ──────────────────────────────────────────────
// Rich text helpers (kept here to avoid circular imports)
// ──────────────────────────────────────────────

export function textToDoc(text: string): RichTextNode {
  const paragraphs = text.split(/\r?\n\s*\r?\n/);
  return {
    type: "doc",
    content: paragraphs.map((p) =>
      p.length > 0 ? { type: "paragraph", content: [{ type: "text", text: p }] } : { type: "paragraph" },
    ),
  };
}

const BLOCK_TYPES = new Set(["paragraph", "heading", "blockquote", "listItem", "codeBlock"]);

export function extractPlainText(node: RichTextNode): string {
  const blocks: string[] = [];
  const walk = (n: RichTextNode, acc: string[]): void => {
    if (typeof n.text === "string") acc.push(n.text);
    if (n.type === "hardBreak") acc.push("\n");
    for (const child of n.content ?? []) {
      if (child.type && BLOCK_TYPES.has(child.type)) {
        const inner: string[] = [];
        walk(child, inner);
        blocks.push(inner.join(""));
      } else {
        walk(child, acc);
      }
    }
  };
  const rootAcc: string[] = [];
  walk(node, rootAcc);
  if (rootAcc.length > 0) blocks.unshift(rootAcc.join(""));
  return blocks.join("\n").trim();
}
