"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Hexagon } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [isDevBypassMode, setIsDevBypassMode] = useState(false);
  
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      if (isDevBypassMode) {
        const response = await fetchApi("/auth/dev-login", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        login(response.accessToken, response.user);
        return;
      }

      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister 
        ? { email, username, displayName, password }
        : { email, password };

      const response = await fetchApi(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      login(response.accessToken, response.user);
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    }
  };

  return (
    <div className="flex h-screen w-full bg-background items-center justify-center p-6 relative">
      <motion.div 
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full layer-4-modal rounded p-8 flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded bg-primary/20 flex items-center justify-center glow-primary">
            <Hexagon className="text-primary w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Arcane Telemetry</h1>
          <p className="text-[13px] text-text-muted font-telemetry uppercase tracking-widest">
            {isDevBypassMode ? "Development Bypass Mode" : isRegister ? "Node Registration" : "Node Authentication"}
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-[13px] p-3 rounded font-telemetry glow-danger">
            &gt; ERROR: {error}
          </div>
        )}

        {process.env.NODE_ENV === "development" && (
          <div className="flex bg-surface-dim border border-border-subtle rounded p-1 gap-1 mb-2">
            <button
              type="button"
              onClick={() => setIsDevBypassMode(false)}
              className={`flex-1 py-1.5 rounded text-[11px] font-telemetry uppercase tracking-wider transition-all ${!isDevBypassMode ? 'bg-surface-base text-white shadow-sm border border-border-subtle' : 'text-text-muted hover:text-white'}`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setIsDevBypassMode(true)}
              className={`flex-1 py-1.5 rounded text-[11px] font-telemetry uppercase tracking-wider transition-all ${isDevBypassMode ? 'bg-secondary/20 text-secondary border border-secondary/50 glow-secondary shadow-sm' : 'text-text-muted hover:text-secondary'}`}
            >
              Dev Bypass
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isDevBypassMode && isRegister && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-text-muted uppercase tracking-wider font-telemetry">Username</label>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="bg-surface-dim border border-border-subtle rounded px-4 py-2.5 text-[13px] focus:outline-none focus:border-secondary text-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-text-muted uppercase tracking-wider font-telemetry">Display Name</label>
                <input 
                  type="text" 
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="bg-surface-dim border border-border-subtle rounded px-4 py-2.5 text-[13px] focus:outline-none focus:border-secondary text-white"
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted uppercase tracking-wider font-telemetry">
              {isDevBypassMode ? "Target Node Email" : "Email Address"}
            </label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-surface-dim border border-border-subtle rounded px-4 py-2.5 text-[13px] focus:outline-none focus:border-secondary text-white"
            />
          </div>

          {!isDevBypassMode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-text-muted uppercase tracking-wider font-telemetry">Encryption Key (Password)</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-surface-dim border border-border-subtle rounded px-4 py-2.5 text-[13px] focus:outline-none focus:border-secondary text-white font-telemetry"
              />
            </div>
          )}

          <button 
            type="submit"
            className={`mt-4 text-background py-3 rounded text-[13px] font-bold w-full uppercase tracking-widest ${isDevBypassMode ? 'bg-secondary glow-secondary-hover' : 'bg-primary glow-primary-hover'}`}
          >
            {isDevBypassMode ? "Bypass Authentication" : isRegister ? "Establish Link" : "Authenticate"}
          </button>
        </form>

        {!isDevBypassMode && (
          <div className="flex flex-col gap-4 mt-2 border-t border-border-subtle pt-6">
            <button 
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-[12px] text-text-muted hover:text-white transition-colors text-center w-full"
            >
              {isRegister ? "Already linked? Authenticate here." : "No node ID? Register here."}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
