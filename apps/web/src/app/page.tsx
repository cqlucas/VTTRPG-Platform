"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Hexagon, Users, Plus, Search, Shield, Bell, LogOut, LayoutGrid, User } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function DashboardPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [myTables, setMyTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("campanhas");
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
    
    // Check if the user is already a member
    if (myTables.some(t => t.id === inviteCode)) {
      router.push(`/table/${inviteCode}`);
      return;
    }

    try {
      await fetchApi(`/campaigns/${inviteCode}/join`, { method: "POST" });
      const updated = await fetchApi("/campaigns/my");
      setMyTables(updated);
      setInviteCode("");
      router.push(`/table/${inviteCode}`);
    } catch (err) {
      alert("Falha ao entrar na mesa: " + (err as Error).message);
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
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          <div className="mb-2 label-caps text-text-muted px-2">
            Navegação
          </div>
          
          <button 
            onClick={() => setActiveTab("campanhas")}
            className={`w-full p-3 rounded flex items-center gap-3 font-medium text-[13px] transition-colors ${
              activeTab === "campanhas" 
                ? "bg-surface-base border border-border-subtle text-white" 
                : "bg-transparent border border-transparent hover:border-border-subtle text-text-muted hover:text-white"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Campanhas
          </button>
          
          <button 
            onClick={() => setActiveTab("perfil")}
            className={`w-full p-3 rounded flex items-center gap-3 font-medium text-[13px] transition-colors ${
              activeTab === "perfil" 
                ? "bg-surface-base border border-border-subtle text-white" 
                : "bg-transparent border border-transparent hover:border-border-subtle text-text-muted hover:text-white"
            }`}
          >
            <User className="w-4 h-4" />
            Perfil
          </button>
        </div>

        <div className="p-4 border-t border-border-subtle layer-1-well m-4 rounded flex items-center gap-3">
          <button onClick={logout} title="Sair" className="text-text-muted hover:text-danger transition-colors p-2 rounded hover:bg-surface-base flex-shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 flex-shrink-0 rounded-full bg-surface-base border border-secondary/50 flex items-center justify-center font-telemetry text-secondary text-xs uppercase overflow-hidden">
              {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : user.username.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-white truncate">{user.displayName}</div>
              <div className="text-[10px] font-telemetry text-secondary flex items-center gap-1">
                <div className="w-1.5 h-1.5 flex-shrink-0 rounded-full bg-success"></div>
                ONLINE
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      <main className="flex-1 p-8 overflow-y-auto flex flex-col items-center relative">
        <div className="max-w-5xl w-full flex flex-col gap-10 z-10 mt-4">
          
          {activeTab === "campanhas" ? (
            <>
              {/* Top Row: Join & Create */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="layer-3-floating rounded-lg p-6 flex flex-col gap-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                    <Search className="w-24 h-24" />
                  </div>
                  
                  <div>
                    <h2 className="text-lg font-semibold mb-1 text-white">Entrar em uma Mesa</h2>
                    <p className="text-text-muted text-[13px]">Insira o código da campanha para participar.</p>
                  </div>

                  <div className="flex gap-2 relative mt-2">
                    <input 
                      type="text" 
                      placeholder="Código da mesa..."
                      className="font-telemetry flex-1 bg-surface-dim border border-border-subtle rounded px-4 py-2 focus:outline-none focus:border-secondary transition-colors text-white placeholder:text-text-muted/50 text-[13px]"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                    />
                    <button 
                      onClick={handleJoin}
                      className="bg-surface-floating border border-border-subtle hover:bg-slate-700 text-white px-5 rounded text-[13px] font-medium transition-colors"
                    >
                      Entrar
                    </button>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="layer-3-floating rounded-lg p-6 flex flex-col gap-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                    <Hexagon className="w-24 h-24" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold mb-1 text-white">Criar uma Mesa</h2>
                    <p className="text-text-muted text-[13px]">Inicie uma nova campanha como mestre.</p>
                  </div>

                  <div className="flex-1 flex flex-col justify-end mt-2">
                    <Link href="/create" className="block w-full">
                      <motion.div 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full border border-border-subtle hover:border-primary/50 hover:bg-primary/5 rounded-lg py-2.5 flex items-center justify-center gap-3 cursor-pointer transition-all group layer-1-well"
                      >
                        <div className="w-6 h-6 rounded bg-surface-base border border-border-subtle flex items-center justify-center group-hover:border-primary/50 transition-colors">
                          <Plus className="w-3 h-3 text-text-muted group-hover:text-primary transition-colors" />
                        </div>
                        <span className="font-medium text-[13px] text-text-muted group-hover:text-primary transition-colors">Nova Mesa</span>
                      </motion.div>
                    </Link>
                  </div>
                </motion.div>

              </div>

              {/* Bottom Row: Tables List */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Hexagon className="w-5 h-5 text-primary" />
                    Minhas Mesas
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {isLoading ? (
                    <div className="col-span-full p-8 flex items-center justify-center text-[12px] text-text-muted font-telemetry animate-pulse border border-dashed border-border-subtle rounded-lg">
                      CARREGANDO DADOS...
                    </div>
                  ) : myTables.length === 0 ? (
                    <div className="col-span-full p-8 flex items-center justify-center text-[12px] text-text-muted font-telemetry border border-dashed border-border-subtle rounded-lg">
                      NENHUMA MESA ENCONTRADA
                    </div>
                  ) : (
                    myTables.map((table) => {
                      const isHost = table.hostId === user.id;
                      return (
                        <Link key={table.id} href={`/table/${table.id}`}>
                          <motion.div
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="p-5 rounded-lg bg-surface-base border border-border-subtle hover:border-primary/50 transition-all flex flex-col gap-3 cursor-pointer group shadow-sm hover:shadow-primary/10 h-full"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-[15px] text-white group-hover:text-primary transition-colors line-clamp-2">
                                {table.name}
                              </div>
                              <div className="p-1.5 rounded-md bg-surface-dim border border-border-subtle shrink-0">
                                {isHost ? <Shield className="w-3.5 h-3.5 text-primary" /> : <Users className="w-3.5 h-3.5 text-secondary" />}
                              </div>
                            </div>
                            
                            <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-text-muted border-t border-border-subtle/50">
                              <span className="flex items-center gap-1.5 font-telemetry">
                                <span className={`w-1.5 h-1.5 rounded-full ${isHost ? 'bg-primary' : 'bg-secondary'}`}></span>
                                {isHost ? "Mestre" : "Jogador"}
                              </span>
                              <span className="font-telemetry opacity-50">
                                ID: {table.id.slice(0, 6)}
                              </span>
                            </div>
                          </motion.div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </>
          ) : (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-col gap-6"
            >
              <div className="layer-3-floating rounded-lg p-8 md:p-10 flex flex-col md:flex-row gap-8 items-center md:items-start border border-border-subtle relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <User className="w-64 h-64" />
                </div>
                
                <div className="w-32 h-32 shrink-0 rounded-full bg-surface-base border-4 border-surface-dim flex items-center justify-center font-telemetry text-secondary text-5xl uppercase overflow-hidden shadow-xl z-10">
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : user.username.slice(0, 2)}
                </div>
                
                <div className="flex flex-col items-center md:items-start gap-4 flex-1 z-10 w-full">
                  <div className="text-center md:text-left">
                    <h2 className="text-3xl font-bold text-white">{user.displayName}</h2>
                    <p className="text-text-muted font-telemetry mt-1 text-sm">@{user.username}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start w-full mt-2">
                    <div className="bg-surface-dim rounded-lg p-4 border border-border-subtle flex-1 md:flex-none md:min-w-[150px] text-center">
                      <div className="text-2xl font-bold text-primary">{myTables.length}</div>
                      <div className="text-[11px] text-text-muted font-telemetry uppercase tracking-wider mt-1">Mesas Jogadas</div>
                    </div>
                    
                    <div className="bg-surface-dim rounded-lg p-4 border border-border-subtle flex-1 md:flex-none md:min-w-[150px] text-center">
                      <div className="text-2xl font-bold text-secondary">
                        {(user as any).createdAt ? new Date((user as any).createdAt).getFullYear() : new Date().getFullYear()}
                      </div>
                      <div className="text-[11px] text-text-muted font-telemetry uppercase tracking-wider mt-1">Membro Desde</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 w-full md:w-auto">
                    <Link href="/perfil/editar" className="block w-full">
                      <button className="w-full md:w-auto bg-surface-floating hover:bg-slate-700 border border-border-subtle text-white px-8 py-2.5 rounded font-medium transition-colors text-[13px]">
                        Editar Perfil
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </main>
    </div>
  );
}
