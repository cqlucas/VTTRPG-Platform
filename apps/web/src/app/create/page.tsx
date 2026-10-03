"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Database, Globe, Hash } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function CreateTablePage() {
  const [name, setName] = useState("");
  const [system, setSystem] = useState("generic");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await fetchApi("/campaigns", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      // Redirect to the newly created table
      router.push(`/table/${result.id}`);
    } catch (err) {
      alert("Failed to create campaign: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background items-center justify-center p-6 relative">
      <Link href="/" className="absolute top-8 left-8 text-text-muted hover:text-white flex items-center gap-2 transition-colors text-[13px] font-medium">
        <ArrowLeft className="w-4 h-4" />
        Terminate Sequence
      </Link>

      <motion.div 
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl w-full layer-4-modal rounded p-8 md:p-12 flex flex-col gap-8 relative overflow-hidden"
      >
        <div>
          <h1 className="text-3xl font-semibold mb-2 text-white">Initialize Host Node</h1>
          <p className="text-text-muted text-[13px]">Define operational parameters for the new campaign.</p>
        </div>

        <div className="flex flex-col gap-6 mt-2">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Node Designation</label>
            <input 
              type="text" 
              placeholder="e.g. Sector 7 Run"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-dim border border-border-subtle rounded px-4 py-3 focus:outline-none focus:border-secondary transition-colors text-white placeholder:text-text-muted/30 text-[14px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Rule Schema</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: "dnd5e", name: "D&D 5E", icon: <Database className="w-4 h-4 mb-2" /> },
                { id: "pathfinder", name: "Pathfinder 2E", icon: <Globe className="w-4 h-4 mb-2" /> },
                { id: "generic", name: "Agnostic", icon: <Hash className="w-4 h-4 mb-2" /> }
              ].map((sys) => (
                <button 
                  key={sys.id}
                  onClick={() => setSystem(sys.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded border transition-all ${
                    system === sys.id 
                      ? "bg-primary/10 border-primary text-primary glow-primary" 
                      : "bg-surface-base border-border-subtle text-text-muted hover:border-border-accent hover:text-white"
                  }`}
                >
                  {sys.icon}
                  <span className="text-[12px] font-medium font-telemetry">{sys.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border-subtle flex justify-end gap-3 mt-4">
          <Link href="/">
            <button className="px-5 py-2.5 rounded text-[13px] font-medium text-text-muted hover:text-white transition-colors bg-surface-base border border-border-subtle hover:bg-surface-bright">
              Abort
            </button>
          </Link>
          <button 
            onClick={handleCreate}
            disabled={isLoading || !name.trim()}
            className="bg-primary text-background px-6 py-2.5 rounded text-[13px] font-bold transition-all glow-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "EXECUTING..." : "Execute Initialization"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
