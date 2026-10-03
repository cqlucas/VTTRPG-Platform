"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Hexagon, Users, Plus, Search, Shield, Bell, LogOut } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function DashboardPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [myTables, setMyTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const campaigns = await fetchApi("/campaigns/my");
        setMyTables(campaigns);
      } catch (err) {
        console.error("Failed to load campaigns:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCampaigns();
  }, []);

  const handleJoin = async () => {
    if (!inviteCode) return;
    try {
      await fetchApi(`/campaigns/${inviteCode}/join`, { method: "POST" });
      const updated = await fetchApi("/campaigns/my");
      setMyTables(updated);
      setInviteCode("");
    } catch (err) {
      alert("Failed to join: " + (err as Error).message);
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-full w-full bg-background relative">
      <motion.aside 
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-72 layer-2-dock flex flex-col z-10 border-r"
      >
        <div className="p-6 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center glow-primary">
              <Hexagon className="text-primary w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Arcane Node</h1>
          </div>
          <button onClick={logout} className="text-text-muted hover:text-danger transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 label-caps text-text-muted px-2">
            Active Telemetry / Tables
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-[12px] text-text-muted text-center py-4 font-telemetry animate-pulse">SYNCING DATA...</div>
            ) : myTables.length === 0 ? (
              <div className="text-[12px] text-text-muted px-2 font-telemetry">NO ACTIVE NODES</div>
            ) : (
              myTables.map((table) => {
                const isHost = table.hostId === user.id;
                return (
                  <Link key={table.id} href={`/table/${table.id}`}>
                    <motion.div
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(51, 65, 85, 0.4)" }}
                      whileTap={{ scale: 0.98 }}
                      className="p-3 rounded bg-transparent border border-transparent hover:border-border-subtle transition-colors flex flex-col gap-1 cursor-pointer group"
                    >
                      <div className="font-medium text-[13px] text-text-base group-hover:text-primary transition-colors">
                        {table.name}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1">
                        <span className="flex items-center gap-1 font-telemetry">
                          {isHost ? <Shield className="w-3 h-3 text-primary" /> : <Hexagon className="w-3 h-3 text-secondary" />}
                          {isHost ? "Game Master" : "Player"}
                        </span>
                      </div>
                    </motion.div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle layer-1-well m-4 rounded">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-base border border-secondary/50 flex items-center justify-center font-telemetry text-secondary text-xs uppercase overflow-hidden">
              {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : user.username.slice(0, 2)}
            </div>
            <div>
              <div className="text-[13px] font-medium text-white">{user.displayName}</div>
              <div className="text-[10px] font-telemetry text-secondary flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                ONLINE
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      <main className="flex-1 p-8 overflow-y-auto flex flex-col items-center justify-center relative">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="layer-3-floating rounded-lg p-8 flex flex-col gap-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
              <Search className="w-32 h-32" />
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-white">Synchronize Node</h2>
              <p className="text-text-muted text-[13px]">Enter an invite sequence (Campaign ID) to join an established session.</p>
            </div>

            <div className="flex gap-2 relative">
              <input 
                type="text" 
                placeholder="0xSEQUENCE..."
                className="font-telemetry flex-1 bg-surface-dim border border-border-subtle rounded px-4 py-2.5 focus:outline-none focus:border-secondary transition-colors text-white placeholder:text-text-muted/50 text-[13px]"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <button 
                onClick={handleJoin}
                className="bg-surface-floating border border-border-subtle hover:bg-slate-700 text-white px-5 rounded text-[13px] font-medium transition-colors"
              >
                Init Sync
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="layer-3-floating rounded-lg p-8 flex flex-col gap-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
              <Hexagon className="w-32 h-32" />
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2 text-white">Establish Node</h2>
              <p className="text-text-muted text-[13px]">Initialize a new campaign host instance.</p>
            </div>

            <div className="flex-1 flex flex-col justify-center mt-4">
              <Link href="/create" className="block w-full">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full border border-border-subtle hover:border-primary/50 hover:bg-primary/5 rounded-lg p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group layer-1-well"
                >
                  <div className="w-12 h-12 rounded bg-surface-base border border-border-subtle flex items-center justify-center group-hover:border-primary/50 transition-colors">
                    <Plus className="w-6 h-6 text-text-muted group-hover:text-primary transition-colors" />
                  </div>
                  <span className="font-medium text-[13px] text-text-muted group-hover:text-primary transition-colors">Initialize New Node</span>
                </motion.div>
              </Link>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
