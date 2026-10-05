"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Mail, Lock, ArrowLeft, Save } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { fetchApi } from "@/lib/api";
import Link from "next/link";

export default function EditProfilePage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const payload: any = {};
      if (displayName.trim()) payload.displayName = displayName;
      if (username.trim()) payload.username = username;
      if (email.trim()) payload.email = email;
      if (avatarUrl.trim()) payload.avatarUrl = avatarUrl;
      
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      
      // If nothing was changed, just return
      if (Object.keys(payload).length === 0) {
        router.push("/");
        return;
      }

      const res = await fetchApi("/users/me", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      
      updateUser(res.user);
      router.push("/");
    } catch (err: any) {
      alert("Erro ao atualizar o perfil: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4 sm:px-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-xl z-10 flex flex-col gap-6">
        <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-white transition-colors self-start w-fit">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[13px] font-medium">Voltar para o Início</span>
        </Link>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="layer-3-floating rounded-xl p-8 border border-border-subtle shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
            <User className="w-48 h-48" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Editar Perfil</h1>
            <p className="text-text-muted text-[13px]">Atualize suas informações pessoais e credenciais.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-6 relative z-10">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-telemetry uppercase text-secondary tracking-wider mb-2">Informações Básicas</h3>
              
              <div>
                <label className="block text-[13px] text-text-muted mb-1.5 font-medium">Nome de Exibição</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <User className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-surface-dim border border-border-subtle rounded-md pl-10 pr-4 py-2.5 text-white placeholder:text-text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-[14px]"
                    placeholder={user.displayName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] text-text-muted mb-1.5 font-medium">Nome de Usuário (@)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <span className="text-[15px] font-bold">@</span>
                  </div>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="w-full bg-surface-dim border border-border-subtle rounded-md pl-10 pr-4 py-2.5 text-white placeholder:text-text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-[14px]"
                    placeholder={user.username}
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1">Apenas letras minúsculas, números e underlines (_).</p>
              </div>

              <div>
                <label className="block text-[13px] text-text-muted mb-1.5 font-medium">E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-dim border border-border-subtle rounded-md pl-10 pr-4 py-2.5 text-white placeholder:text-text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-[14px]"
                    placeholder={user.email}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] text-text-muted mb-1.5 font-medium">Link da Foto de Perfil (Avatar)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <User className="w-4 h-4" />
                  </div>
                  <input 
                    type="url" 
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full bg-surface-dim border border-border-subtle rounded-md pl-10 pr-4 py-2.5 text-white placeholder:text-text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-[14px]"
                    placeholder={user.avatarUrl || "https://exemplo.com/sua-foto.jpg"}
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1">Cole a URL de uma imagem. Se deixado em branco, mostraremos suas iniciais.</p>
              </div>
            </div>

            <hr className="border-border-subtle my-6" />

            {/* Segurança */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-telemetry uppercase text-secondary tracking-wider mb-2">Segurança</h3>
              
              <div>
                <label className="block text-[13px] text-text-muted mb-1.5 font-medium">Senha Atual (para confirmar alterações)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-surface-dim border border-border-subtle rounded-md pl-10 pr-4 py-2.5 text-white placeholder:text-text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-[14px]"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] text-text-muted mb-1.5 font-medium">Nova Senha (opcional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-surface-dim border border-border-subtle rounded-md pl-10 pr-4 py-2.5 text-white placeholder:text-text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-[14px]"
                    placeholder="Deixe em branco para não alterar"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit"
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2.5 rounded-md transition-colors flex items-center gap-2 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
