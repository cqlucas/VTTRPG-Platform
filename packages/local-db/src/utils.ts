import type { LocalFolder, LoreDocument, RichTextNode } from "./schema";

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

/** Ids are used as file names on disk, so they must be filename-safe. */
export function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Deterministic JSON: object keys sorted recursively, `undefined` dropped. */
export function canonicalize(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : canonicalize(v)));
  if (typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonicalize(v);
    }
    return out;
  }
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  return null;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface DocumentHashInput {
  title: string;
  folderId: string | null;
  content: RichTextNode;
  deleted: boolean;
}

export interface FolderHashInput {
  name: string;
  parentId: string | null;
  deleted: boolean;
}

export function hashDocument(d: DocumentHashInput): Promise<string> {
  return sha256Hex(
    canonicalStringify({ kind: "document", title: d.title, folderId: d.folderId, content: d.content, deleted: d.deleted }),
  );
}

export function hashFolder(f: FolderHashInput): Promise<string> {
  return sha256Hex(canonicalStringify({ kind: "folder", name: f.name, parentId: f.parentId, deleted: f.deleted }));
}

export function hashLocalDocument(d: LoreDocument): Promise<string> {
  return hashDocument(d);
}

export function hashLocalFolder(f: LocalFolder): Promise<string> {
  return hashFolder(f);
}

export const EMPTY_DOC: RichTextNode = { type: "doc", content: [{ type: "paragraph" }] };

/** Formats a timestamp as "DD/MM HH:mm" (used in conflict copy titles). */
export function formatConflictStamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
