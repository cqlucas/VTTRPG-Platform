import {
  CURRENT_ENTRY_SCHEMA_VERSION,
  extractPlainText,
  type LocalFolder,
  type LoreDocument,
  type LoreFolder,
  type QuestDreamerLocalDB,
  type RichTextNode,
  type SyncBaseline,
} from "./schema";
import { canonicalStringify, EMPTY_DOC, newId } from "./utils";

export type LoreEntryKind = "document" | "folder";

export interface LoreDocumentSummary {
  id: string;
  title: string;
  folderId: string | null;
  updatedAt: number;
  revision: number;
}

export interface LoreTree {
  folders: LoreFolder[];
  documents: LoreDocumentSummary[];
}

export interface FolderContentsCount {
  folders: number;
  documents: number;
}

export class LoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoreError";
  }
}

export interface LoreRepositoryOptions {
  now?: () => number;
  /** Called once when the first document is created (used to request persistent storage). */
  onFirstDocument?: () => void;
}

const isLoreFolder = (f: LocalFolder): f is LoreFolder => f.type === "lore";

function normalizeName(name: string, fallback: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 200) : fallback;
}

/**
 * Single entry point for the UI to read/write the compendium.
 * Every user-facing write bumps `revision`, refreshes `updatedAt` and recomputes `plainText`.
 */
export class LoreRepository {
  private readonly clock: () => number;

  constructor(
    readonly db: QuestDreamerLocalDB,
    private readonly options: LoreRepositoryOptions = {},
  ) {
    this.clock = options.now ?? (() => Date.now());
  }

  // ──────────────────────────────────────────────
  // Reads
  // ──────────────────────────────────────────────

  async listTree(): Promise<LoreTree> {
    const [folders, docs] = await Promise.all([
      this.db.folders.where("type").equals("lore").toArray(),
      this.db.loreNodes.toArray(),
    ]);
    return {
      folders: folders
        .filter(isLoreFolder)
        .filter((f) => !f.deleted)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")),
      documents: docs
        .filter((d) => !d.deleted)
        .map((d) => ({ id: d.id, title: d.title, folderId: d.folderId, updatedAt: d.updatedAt, revision: d.revision }))
        .sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
    };
  }

  async hasAnyEntries(): Promise<boolean> {
    const tree = await this.listTree();
    return tree.folders.length > 0 || tree.documents.length > 0;
  }

  async getDocument(id: string): Promise<LoreDocument | undefined> {
    const doc = await this.db.loreNodes.get(id);
    return doc && !doc.deleted ? doc : undefined;
  }

  async getFolder(id: string): Promise<LoreFolder | undefined> {
    const folder = await this.db.folders.get(id);
    return folder && isLoreFolder(folder) && !folder.deleted ? folder : undefined;
  }

  /** Number of entries changed locally since the last successful sync. */
  async countUnsynced(): Promise<number> {
    const [folders, docs, baselines] = await Promise.all([
      this.db.folders.where("type").equals("lore").toArray(),
      this.db.loreNodes.toArray(),
      this.db.syncBaselines.toArray(),
    ]);
    const base = new Map(baselines.map((b) => [b.entryId, b]));
    let count = 0;
    for (const e of [...folders, ...docs]) {
      const b = base.get(e.id);
      if (!b) {
        if (!e.deleted) count++;
      } else if (e.revision > b.revision) {
        count++;
      }
    }
    return count;
  }

  // ──────────────────────────────────────────────
  // Folders
  // ──────────────────────────────────────────────

  async createFolder(name: string, parentId: string | null): Promise<LoreFolder> {
    return this.db.transaction("rw", this.db.folders, async () => {
      if (parentId !== null) await this.requireFolder(parentId);
      const ts = this.clock();
      const folder: LoreFolder = {
        id: newId(),
        type: "lore",
        campaignId: null,
        parentId,
        name: normalizeName(name, "Nova pasta"),
        sortOrder: 0,
        revision: 1,
        createdAt: ts,
        updatedAt: ts,
        deleted: false,
        schemaVersion: CURRENT_ENTRY_SCHEMA_VERSION,
      };
      await this.db.folders.add(folder);
      return folder;
    });
  }

  async renameFolder(id: string, name: string): Promise<void> {
    await this.db.transaction("rw", this.db.folders, async () => {
      const folder = await this.requireFolder(id);
      const next = normalizeName(name, folder.name);
      if (next === folder.name) return;
      await this.db.folders.put(this.touch({ ...folder, name: next }));
    });
  }

  async moveFolder(id: string, parentId: string | null): Promise<void> {
    await this.db.transaction("rw", this.db.folders, async () => {
      const folder = await this.requireFolder(id);
      if (folder.parentId === parentId) return;
      if (parentId !== null) {
        if (parentId === id) throw new LoreError("Uma pasta não pode ser movida para dentro dela mesma.");
        await this.requireFolder(parentId);
        const descendants = await this.descendantFolderIds(id);
        if (descendants.has(parentId)) {
          throw new LoreError("Uma pasta não pode ser movida para dentro de uma subpasta dela.");
        }
      }
      await this.db.folders.put(this.touch({ ...folder, parentId }));
    });
  }

  async countFolderContents(id: string): Promise<FolderContentsCount> {
    const folderIds = await this.descendantFolderIds(id);
    const docs = await this.db.loreNodes.toArray();
    const documents = docs.filter((d) => !d.deleted && d.folderId !== null && (d.folderId === id || folderIds.has(d.folderId))).length;
    return { folders: folderIds.size, documents };
  }

  /** Logical, cascading delete. Returns how many descendants were removed. */
  async deleteFolder(id: string): Promise<FolderContentsCount> {
    return this.db.transaction("rw", this.db.folders, this.db.loreNodes, async () => {
      const folder = await this.requireFolder(id);
      const descendantIds = await this.descendantFolderIds(id);
      const allFolderIds = new Set([id, ...descendantIds]);
      const ts = this.clock();

      const folders = await this.db.folders.bulkGet([...allFolderIds]);
      const folderUpdates = folders
        .filter((f): f is LocalFolder => !!f && !f.deleted)
        .map((f) => this.tombstone(f, ts));
      await this.db.folders.bulkPut(folderUpdates);

      const docs = (await this.db.loreNodes.toArray()).filter(
        (d) => !d.deleted && d.folderId !== null && allFolderIds.has(d.folderId),
      );
      await this.db.loreNodes.bulkPut(docs.map((d) => this.tombstone(d, ts)));

      void folder;
      return { folders: descendantIds.size, documents: docs.length };
    });
  }

  // ──────────────────────────────────────────────
  // Documents
  // ──────────────────────────────────────────────

  async createDocument(input: { title?: string; folderId?: string | null; content?: RichTextNode } = {}): Promise<LoreDocument> {
    const created = await this.db.transaction("rw", this.db.folders, this.db.loreNodes, async () => {
      const folderId = input.folderId ?? null;
      if (folderId !== null) await this.requireFolder(folderId);
      const isFirst = (await this.db.loreNodes.filter((d) => !d.deleted).count()) === 0;
      const ts = this.clock();
      const content = input.content ?? EMPTY_DOC;
      const doc: LoreDocument = {
        id: newId(),
        campaignId: null,
        folderId,
        title: normalizeName(input.title ?? "", "Sem título"),
        content,
        plainText: extractPlainText(content),
        nodeType: "document",
        revision: 1,
        createdAt: ts,
        updatedAt: ts,
        deleted: false,
        schemaVersion: CURRENT_ENTRY_SCHEMA_VERSION,
      };
      await this.db.loreNodes.add(doc);
      return { doc, isFirst };
    });
    if (created.isFirst) this.options.onFirstDocument?.();
    return created.doc;
  }

  /** No-op (no revision bump) when nothing actually changed. */
  async updateDocument(id: string, patch: { title?: string; content?: RichTextNode }): Promise<LoreDocument> {
    return this.db.transaction("rw", this.db.loreNodes, async () => {
      const doc = await this.requireDocument(id);
      const title = patch.title !== undefined ? normalizeName(patch.title, "Sem título") : doc.title;
      const content = patch.content ?? doc.content;
      const changed = title !== doc.title || canonicalStringify(content) !== canonicalStringify(doc.content);
      if (!changed) return doc;
      const next = this.touch({ ...doc, title, content, plainText: extractPlainText(content) });
      await this.db.loreNodes.put(next);
      return next;
    });
  }

  async moveDocument(id: string, folderId: string | null): Promise<void> {
    await this.db.transaction("rw", this.db.folders, this.db.loreNodes, async () => {
      const doc = await this.requireDocument(id);
      if (doc.folderId === folderId) return;
      if (folderId !== null) await this.requireFolder(folderId);
      await this.db.loreNodes.put(this.touch({ ...doc, folderId }));
    });
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.loreNodes, async () => {
      const doc = await this.requireDocument(id);
      await this.db.loreNodes.put(this.tombstone(doc, this.clock()));
    });
  }

  // ──────────────────────────────────────────────
  // Sync-only API (used by SyncEngine, never by the UI)
  // ──────────────────────────────────────────────

  /** All lore entries, including tombstones. */
  async syncSnapshot(): Promise<{ folders: LoreFolder[]; documents: LoreDocument[] }> {
    const [folders, documents] = await Promise.all([
      this.db.folders.where("type").equals("lore").toArray(),
      this.db.loreNodes.toArray(),
    ]);
    return { folders: folders.filter(isLoreFolder), documents };
  }

  /**
   * Writes a folder exactly as given (revision preserved).
   * `expectedRevision` guards against concurrent local edits: `null` = must not exist locally.
   * Returns `false` (and writes nothing) if the local row changed meanwhile.
   */
  async syncPutFolder(record: LoreFolder, expectedRevision: number | null): Promise<boolean> {
    return this.db.transaction("rw", this.db.folders, async () => {
      const current = await this.db.folders.get(record.id);
      if ((current?.revision ?? null) !== expectedRevision) return false;
      await this.db.folders.put({ ...(current ?? {}), ...record });
      return true;
    });
  }

  async syncPutDocument(record: Omit<LoreDocument, "plainText" | "nodeType">, expectedRevision: number | null): Promise<boolean> {
    return this.db.transaction("rw", this.db.loreNodes, async () => {
      const current = await this.db.loreNodes.get(record.id);
      if ((current?.revision ?? null) !== expectedRevision) return false;
      const merged: LoreDocument = {
        ...(current ?? { nodeType: "document", campaignId: null }),
        ...record,
        nodeType: current?.nodeType ?? "document",
        plainText: extractPlainText(record.content),
      };
      if (!record.deleted) delete merged.deletedAt;
      await this.db.loreNodes.put(merged);
      return true;
    });
  }

  async getBaselines(): Promise<Map<string, SyncBaseline>> {
    const rows = await this.db.syncBaselines.toArray();
    return new Map(rows.map((r) => [r.entryId, r]));
  }

  async putBaseline(baseline: SyncBaseline): Promise<void> {
    await this.db.syncBaselines.put(baseline);
  }

  async clearBaselines(): Promise<void> {
    await this.db.syncBaselines.clear();
  }

  // ──────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────

  private touch<T extends LocalFolder | LoreDocument>(entry: T): T {
    return { ...entry, revision: entry.revision + 1, updatedAt: Math.max(this.clock(), entry.updatedAt) };
  }

  private tombstone<T extends LocalFolder | LoreDocument>(entry: T, ts: number): T {
    return { ...entry, deleted: true, deletedAt: ts, revision: entry.revision + 1, updatedAt: Math.max(ts, entry.updatedAt) };
  }

  private async requireFolder(id: string): Promise<LoreFolder> {
    const folder = await this.getFolder(id);
    if (!folder) throw new LoreError("Pasta não encontrada.");
    return folder;
  }

  private async requireDocument(id: string): Promise<LoreDocument> {
    const doc = await this.getDocument(id);
    if (!doc) throw new LoreError("Documento não encontrado.");
    return doc;
  }

  /** Ids of all non-deleted descendant folders (excluding `id` itself). */
  private async descendantFolderIds(id: string): Promise<Set<string>> {
    const all = (await this.db.folders.where("type").equals("lore").toArray()).filter((f) => !f.deleted);
    const byParent = new Map<string, string[]>();
    for (const f of all) {
      if (f.parentId === null) continue;
      const list = byParent.get(f.parentId) ?? [];
      list.push(f.id);
      byParent.set(f.parentId, list);
    }
    const result = new Set<string>();
    const stack = [...(byParent.get(id) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (result.has(next) || next === id) continue;
      result.add(next);
      stack.push(...(byParent.get(next) ?? []));
    }
    return result;
  }
}
