import { useState, useEffect } from "react";
import { FolderHeart, RefreshCw, AlertCircle, FileSearch } from "lucide-react";
import { BrowserFsAdapter, pickDirectory, queryDirPermission, requestDirPermission } from "@questdreamer/local-db/src/sync/browser-fs-adapter";
import { SyncEngine } from "@questdreamer/local-db/src/sync/sync-engine";
import { loreRepo, localDb } from "../../lib/lore";
import type { SyncLink } from "@questdreamer/local-db/src/schema";

export function StorageSyncSection() {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error" | "success">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [needsPermission, setNeedsPermission] = useState(false);
  const [folderName, setFolderName] = useState("");

  useEffect(() => {
    async function loadLink() {
      const link = await localDb.syncLinks.get("default");
      if (link?.dirHandle) {
        setHandle(link.dirHandle);
        setFolderName(link.dirName);
        const perm = await queryDirPermission(link.dirHandle);
        setNeedsPermission(perm !== "granted");
      }
    }
    loadLink();
  }, []);

  const handleLinkFolder = async () => {
    const res = await pickDirectory();
    if (res.status === "picked") {
      setHandle(res.handle);
      setFolderName(res.handle.name);
      setNeedsPermission(false);
      const deviceId = localStorage.getItem("arcane-device-id") || crypto.randomUUID();
      localStorage.setItem("arcane-device-id", deviceId);
      await localDb.syncLinks.put({
        id: "default",
        dirHandle: res.handle,
        dirName: res.handle.name,
        deviceId
      });
    } else if (res.status === "error") {
      alert("Erro ao selecionar a pasta: " + res.message);
    }
  };

  const handleRequestPermission = async () => {
    if (!handle) return;
    const perm = await requestDirPermission(handle);
    if (perm === "granted") {
      setNeedsPermission(false);
    }
  };

  const handleSync = async () => {
    if (!handle) return;
    if (needsPermission) {
      await handleRequestPermission();
      return;
    }
    
    setSyncStatus("syncing");
    setSyncMessage("Sincronizando...");
    
    try {
      const link = await localDb.syncLinks.get("default");
      const deviceId = link?.deviceId || "dev";
      const adapter = new BrowserFsAdapter(handle);
      const engine = new SyncEngine(loreRepo, adapter);
      const res = await engine.sync({ deviceId });

      if (res.ok) {
        setSyncStatus("success");
        setSyncMessage(`Sincronizado: ${res.pushed} env, ${res.pulled} rec, ${res.conflicts} conf.`);
        if (link) await localDb.syncLinks.put({ ...link, lastSyncAt: Date.now() });
      } else {
        setSyncStatus("error");
        setSyncMessage(`Erro: ${res.error}`);
      }
    } catch (err) {
      setSyncStatus("error");
      setSyncMessage(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FolderHeart className="w-5 h-5 text-primary" />
          Sincronização Local (Vault)
        </h3>
        <p className="text-sm text-text-muted mt-1">
          O Arcane Node salva seus documentos de compêndio localmente por padrão (IndexedDB).
          Vincule uma pasta do seu computador para persistir e sincronizar seus dados em arquivos JSON legíveis.
        </p>
      </div>

      <div className="bg-surface-dim border border-border-subtle p-5 rounded-lg flex flex-col gap-4">
        {handle ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Pasta vinculada</p>
                <p className="text-xs text-text-muted">{folderName || "Pasta local"}</p>
              </div>
              <button 
                onClick={handleLinkFolder}
                className="text-xs px-3 py-1.5 border border-border-subtle rounded text-text-muted hover:text-white hover:border-text-muted transition-colors"
              >
                Mudar Pasta
              </button>
            </div>
            
            <div className="border-t border-border-subtle pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {needsPermission ? (
                  <button
                    onClick={handleRequestPermission}
                    className="bg-secondary hover:bg-secondary/90 text-white px-4 py-2 rounded text-[13px] font-medium transition-colors"
                  >
                    Conceder Permissão
                  </button>
                ) : (
                  <button
                    onClick={handleSync}
                    disabled={syncStatus === "syncing"}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded text-[13px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
                    {syncStatus === "syncing" ? "Sincronizando..." : "Sincronizar Agora"}
                  </button>
                )}
                {syncStatus === "success" && <span className="text-xs text-green-400">{syncMessage}</span>}
                {syncStatus === "error" && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{syncMessage}</span>}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileSearch className="w-10 h-10 text-text-muted/50 mb-3" />
            <p className="text-sm text-white font-medium mb-1">Nenhuma pasta vinculada</p>
            <p className="text-xs text-text-muted mb-4 max-w-sm">
              Ao vincular uma pasta, seus documentos serão salvos lá automaticamente e você poderá sincronizá-los entre navegadores usando serviços como Google Drive, Dropbox ou Syncthing.
            </p>
            <button
              onClick={handleLinkFolder}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded text-[13px] font-medium transition-colors"
            >
              Vincular Pasta Local
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
