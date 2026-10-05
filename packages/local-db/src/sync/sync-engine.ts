import type { LoreRepository, LoreDocumentSummary } from "../lore-repository";
import type { FileAdapter } from "./file-adapter";
import {
  APP_ID,
  MANIFEST_SCHEMA_VERSION,
  type Manifest,
  type ManifestEntry,
  parseManifest,
  folderToFile,
  documentToFile,
  fileToFolder,
  parseDocumentFile,
  parseFolderFile,
  serialize,
  entryPath,
} from "./format";
import { hashLocalDocument, hashLocalFolder, newId, formatConflictStamp } from "../utils";
import type { SyncBaseline } from "../schema";

export interface SyncOptions {
  deviceId: string;
  forceOverwriteLocal?: boolean;
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  pushed: number;
  pulled: number;
  conflicts: number;
}

export class SyncEngine {
  constructor(
    private readonly repo: LoreRepository,
    private readonly adapter: FileAdapter,
  ) {}

  async sync(options: SyncOptions): Promise<SyncResult> {
    if (!this.adapter.isAvailable()) {
      return { ok: false, error: "Acesso à pasta não disponível", pushed: 0, pulled: 0, conflicts: 0 };
    }

    try {
      await this.adapter.acquireLock(options.deviceId);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err), pushed: 0, pulled: 0, conflicts: 0 };
    }

    try {
      return await this._doSync(options);
    } finally {
      await this.adapter.releaseLock(options.deviceId).catch(console.error);
    }
  }

  private async _doSync(options: SyncOptions): Promise<SyncResult> {
    const rawManifest = await this.adapter.readManifest();
    let remoteManifest: Manifest | null = null;
    let entriesFromDir = false;

    if (rawManifest !== null) {
      const parsed = parseManifest(rawManifest);
      if (!parsed.ok) {
        // If manifest is corrupted, try to build it from the dir contents.
        console.warn(`Manifest invalid: ${parsed.error}. Falling back to directory scan.`);
        remoteManifest = await this._buildManifestFromDir();
        entriesFromDir = true;
      } else {
        remoteManifest = parsed.value;
      }
    } else {
      const isEmpty = await this.adapter.isEmpty();
      if (!isEmpty) {
        // Not empty without a manifest: recover it
        remoteManifest = await this._buildManifestFromDir();
        entriesFromDir = true;
      } else {
        // Empty folder, clean start
        remoteManifest = { appId: APP_ID, schemaVersion: MANIFEST_SCHEMA_VERSION, updatedAt: Date.now(), entries: [] };
      }
    }

    const { folders, documents } = await this.repo.syncSnapshot();
    const localBaselines = await this.repo.getBaselines();

    const remoteMap = new Map<string, ManifestEntry>();
    for (const entry of remoteManifest.entries) {
      remoteMap.set(entry.id, entry);
    }

    const localMap = new Map<string, { kind: "folder" | "document"; data: any; hash: string }>();
    for (const f of folders) {
      localMap.set(f.id, { kind: "folder", data: f, hash: await hashLocalFolder(f) });
    }
    for (const d of documents) {
      localMap.set(d.id, { kind: "document", data: d, hash: await hashLocalDocument(d) });
    }

    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

    let pushed = 0;
    let pulled = 0;
    let conflicts = 0;

    const newRemoteManifest: Manifest = {
      appId: APP_ID,
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      updatedAt: Date.now(),
      entries: [],
    };
    const newBaselines: SyncBaseline[] = [];

    // To handle conflicts correctly, we need to process folders before documents when pulling (since docs need folders),
    // but the conflict logic might create new documents. Let's do a unified pass.
    
    // We will collect actions to perform
    const actions: {
      type: "push" | "pull" | "conflict";
      id: string;
      kind: "folder" | "document";
      localData?: any;
      remoteEntry?: ManifestEntry;
      remoteData?: any;
      conflictStrategy?: "local-wins" | "remote-wins"; // which one takes the original ID. The other is duplicated (if doc).
    }[] = [];

    for (const id of allIds) {
      const L = localMap.get(id);
      const R = remoteMap.get(id);
      const B = localBaselines.get(id);

      if (L && !R) {
        if (!B) {
          // Created locally
          actions.push({ type: "push", id, kind: L.kind, localData: L.data });
        } else {
          // Deleted remotely? But R is missing. If it was deleted remotely, it should be in the manifest as deleted: true, unless it's a completely new device pulling a partial manifest.
          // Since our manifest uses tombstones, R missing means it was NEVER on remote (e.g. baseline is leftover from another folder? Or manifest was rebuilt from dir and the tombstone file was purged).
          // We assume remote is the source of truth if B exists and R doesn't (remote hard delete).
          actions.push({ type: "pull", id, kind: L.kind, remoteEntry: undefined });
        }
      } else if (!L && R) {
        if (!B) {
          // Created remotely
          actions.push({ type: "pull", id, kind: R.kind, remoteEntry: R });
        } else {
          // Deleted locally (we should have a local tombstone, but if L is totally missing, it's weird - we use tombstones).
          // Assuming hard delete locally for some reason, we delete remotely.
          actions.push({ type: "push", id, kind: R.kind, localData: { id, deleted: true, revision: B.revision + 1, updatedAt: Date.now() } });
        }
      } else if (L && R) {
        const localChanged = !B || L.hash !== B.hash;
        const remoteChanged = !B || R.hash !== B.hash || R.revision > B.revision;

        if (localChanged && remoteChanged) {
          if (L.hash === R.hash) {
            // Same changes on both sides (e.g. manual apply)
            newBaselines.push({ entryId: id, revision: Math.max(L.data.revision, R.revision), hash: L.hash });
            newRemoteManifest.entries.push(R);
          } else {
            // Conflict
            let localWins = L.data.revision > R.revision || (L.data.revision === R.revision && L.data.updatedAt >= R.updatedAt);
            if (options.forceOverwriteLocal) localWins = false;

            actions.push({
              type: "conflict",
              id,
              kind: L.kind,
              localData: L.data,
              remoteEntry: R,
              conflictStrategy: localWins ? "local-wins" : "remote-wins"
            });
          }
        } else if (localChanged) {
          actions.push({ type: "push", id, kind: L.kind, localData: L.data });
        } else if (remoteChanged) {
          actions.push({ type: "pull", id, kind: L.kind, localData: L.data, remoteEntry: R });
        } else {
          // No changes
          newBaselines.push({ entryId: id, revision: R.revision, hash: R.hash });
          newRemoteManifest.entries.push(R);
        }
      }
    }

    // Now execute actions
    
    // Process pulls first (so folders exist for documents)
    for (const a of actions.filter(x => x.type === "pull" || (x.type === "conflict" && x.conflictStrategy === "remote-wins"))) {
      if (a.remoteEntry) {
        // Fetch remote data
        const raw = await this.adapter.readEntry(a.remoteEntry.path);
        if (raw) {
          if (a.kind === "folder") {
            const parsed = parseFolderFile(raw, a.id);
            if (parsed.ok) {
              const f = fileToFolder(parsed.value);
              await this.repo.syncPutFolder(f, a.localData ? a.localData.revision : null);
              newBaselines.push({ entryId: a.id, revision: f.revision, hash: a.remoteEntry.hash });
              newRemoteManifest.entries.push(a.remoteEntry);
              if (a.type === "pull") pulled++;
            }
          } else {
            const parsed = parseDocumentFile(raw, a.id);
            if (parsed.ok) {
              const f = parsed.value;
              await this.repo.syncPutDocument({
                id: f.id,
                folderId: f.folderId,
                title: f.title,
                content: f.content,
                revision: f.revision,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt,
                deleted: f.deleted,
                deletedAt: f.deletedAt,
                schemaVersion: f.schemaVersion,
                campaignId: null,
              }, a.localData ? a.localData.revision : null);
              newBaselines.push({ entryId: a.id, revision: f.revision, hash: a.remoteEntry.hash });
              newRemoteManifest.entries.push(a.remoteEntry);
              if (a.type === "pull") pulled++;
            }
          }
        } else {
          // Remote entry missing despite manifest? We can't pull. Skip.
          console.warn(`Remote entry ${a.remoteEntry.path} missing from disk.`);
        }
      } else {
        // Hard remote delete (no entry)
        if (a.kind === "folder") {
          await this.repo.syncPutFolder({ id: a.id, deleted: true, deletedAt: Date.now(), revision: 999999 } as any, a.localData ? a.localData.revision : null);
        } else {
          await this.repo.syncPutDocument({ id: a.id, deleted: true, deletedAt: Date.now(), revision: 999999 } as any, a.localData ? a.localData.revision : null);
        }
        pulled++;
      }

      if (a.type === "conflict") {
        conflicts++;
        // The one that lost gets copied
        if (a.kind === "document" && a.localData && a.remoteEntry) {
          const newDocId = newId();
          const copy = { ...a.localData, id: newDocId, title: a.localData.title + ` (Conflito ${formatConflictStamp(Date.now())})` };
          await this.repo.syncPutDocument(copy, null);
          const hash = await hashLocalDocument(copy as any);
          const fData = documentToFile(copy as any);
          await this.adapter.writeEntry(entryPath("document", newDocId), serialize(fData));
          newBaselines.push({ entryId: newDocId, revision: copy.revision, hash });
          newRemoteManifest.entries.push({
            id: newDocId,
            kind: "document",
            path: entryPath("document", newDocId),
            revision: copy.revision,
            updatedAt: copy.updatedAt,
            hash,
            deleted: copy.deleted,
          });
          pushed++;
        }
      }
    }

    // Process pushes
    for (const a of actions.filter(x => x.type === "push" || (x.type === "conflict" && x.conflictStrategy === "local-wins"))) {
      let remoteRaw: string | null = null;
      if (a.type === "conflict" && a.kind === "document" && a.remoteEntry) {
        // Read remote before overwriting it!
        remoteRaw = await this.adapter.readEntry(a.remoteEntry.path);
      }

      if (a.localData) {
        const path = entryPath(a.kind, a.id);
        const hash = a.kind === "folder" ? await hashLocalFolder(a.localData) : await hashLocalDocument(a.localData);
        let fData;
        if (a.kind === "folder") {
          fData = folderToFile(a.localData);
        } else {
          fData = documentToFile(a.localData);
        }
        await this.adapter.writeEntry(path, serialize(fData));
        newBaselines.push({ entryId: a.id, revision: a.localData.revision, hash });
        newRemoteManifest.entries.push({
          id: a.id,
          kind: a.kind,
          path,
          revision: a.localData.revision,
          updatedAt: a.localData.updatedAt,
          hash,
          deleted: a.localData.deleted,
        });
        if (a.type === "push") pushed++;
      }

      if (a.type === "conflict") {
        conflicts++;
        // The remote one lost, we copy it locally and push it back as a conflict file
        if (a.kind === "document" && a.remoteEntry && remoteRaw) {
          const parsed = parseDocumentFile(remoteRaw, a.remoteEntry.id);
          if (parsed.ok) {
              const newDocId = newId();
              const copy = {
                ...parsed.value,
                id: newDocId,
                title: parsed.value.title + ` (Conflito ${formatConflictStamp(Date.now())})`,
                revision: 1,
                updatedAt: Date.now()
              };
              // Write locally
              await this.repo.syncPutDocument({
                id: copy.id,
                folderId: copy.folderId,
                title: copy.title,
                content: copy.content,
                revision: copy.revision,
                createdAt: copy.createdAt,
                updatedAt: copy.updatedAt,
                deleted: copy.deleted,
                deletedAt: copy.deletedAt,
                schemaVersion: copy.schemaVersion,
                campaignId: null,
              }, null);
              
              const copyHash = await hashLocalDocument(copy as any); // Close enough for test
              const cData = documentToFile(copy as any);
              await this.adapter.writeEntry(entryPath("document", newDocId), serialize(cData));
              newBaselines.push({ entryId: newDocId, revision: copy.revision, hash: copyHash });
              newRemoteManifest.entries.push({
                id: newDocId,
                kind: "document",
                path: entryPath("document", newDocId),
                revision: copy.revision,
                updatedAt: copy.updatedAt,
                hash: copyHash,
                deleted: copy.deleted,
              });
              pulled++;
            }
          }
        }
      }

    // Write final baselines and manifest
    await this.repo.clearBaselines();
    for (const b of newBaselines) {
      await this.repo.putBaseline(b);
    }
    await this.adapter.writeManifest(newRemoteManifest);

    return { ok: true, pushed, pulled, conflicts };
  }

  private async _buildManifestFromDir(): Promise<Manifest> {
    const manifest: Manifest = {
      appId: APP_ID,
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      updatedAt: Date.now(),
      entries: [],
    };
    const paths = await this.adapter.listEntryPaths();
    for (const path of paths) {
      const raw = await this.adapter.readEntry(path);
      if (!raw) continue;
      if (path.startsWith("lore/folders/")) {
        const id = path.slice("lore/folders/".length, -5);
        const parsed = parseFolderFile(raw, id);
        if (parsed.ok) {
          const f = fileToFolder(parsed.value);
          manifest.entries.push({
            id,
            kind: "folder",
            path,
            revision: f.revision,
            updatedAt: f.updatedAt,
            hash: await hashLocalFolder(f),
            deleted: f.deleted
          });
        }
      } else if (path.startsWith("lore/documents/")) {
        const id = path.slice("lore/documents/".length, -5);
        const parsed = parseDocumentFile(raw, id);
        if (parsed.ok) {
          const docData = parsed.value;
          manifest.entries.push({
            id,
            kind: "document",
            path,
            revision: docData.revision,
            updatedAt: docData.updatedAt,
            hash: await hashLocalDocument({
              ...docData,
              campaignId: null,
              nodeType: "document",
              plainText: ""
            } as any),
            deleted: docData.deleted
          });
        }
      }
    }
    return manifest;
  }
}
