import { BaseFileAdapter } from "./file-adapter";

/** Test double: a folder kept in a Map (path -> text). `files` is public for inspection. */
export class InMemoryAdapter extends BaseFileAdapter {
  readonly files = new Map<string, string>();
  /** Every path written, in order (useful to assert no-op syncs). */
  readonly writes: string[] = [];

  isAvailable(): boolean {
    return true;
  }

  async isEmpty(): Promise<boolean> {
    return this.files.size === 0;
  }

  protected async readText(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  protected async writeText(path: string, data: string): Promise<void> {
    this.writes.push(path);
    this.files.set(path, data);
  }

  protected async removeFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  protected async listFiles(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    return [...this.files.keys()]
      .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
      .map((p) => p.slice(prefix.length));
  }
}
