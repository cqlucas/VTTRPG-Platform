"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Users, Settings, Dices, Send, Shield, Hexagon, Activity } from "lucide-react";

export default function TablePage() {
  const [chatMessage, setChatMessage] = useState("");
  
  const players = [
    { id: "1", name: "GM_Gandalf", role: "GM", ping: 12 },
    { id: "2", name: "Hero_123", role: "Player", ping: 45 },
    { id: "3", name: "ShadowStalker", role: "Player", ping: 135 },
  ];

  const chatHistory = [
    { id: "1", sender: "System", text: "Link established. Secure channel.", type: "system", timestamp: "20:00" },
    { id: "2", sender: "GM_Gandalf", text: "Alright everyone, you stand before the Gates of Barovia.", type: "chat", timestamp: "20:01" },
    { id: "3", sender: "Hero_123", text: "I'll draw my sword.", type: "chat", timestamp: "20:02" },
    { id: "4", sender: "ShadowStalker", formula: "1d20 + 7", result: 18, type: "roll", timestamp: "20:03" },
    { id: "5", sender: "GM_Gandalf", text: "Target Lock Acquired.", type: "system-alert", timestamp: "20:04" }
  ];

  const getPingColor = (ping: number) => {
    if (ping < 50) return "bg-success";
    if (ping < 120) return "bg-primary";
    return "bg-danger";
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-[13px]">
      
      {/* Left Sidebar - Navigation & Players (Layer 2) */}
      <aside className="w-16 md:w-64 layer-2-dock flex flex-col z-20">
        <div className="p-4 border-b border-border-subtle flex items-center gap-3">
          <Link href="/" className="p-1.5 hover:bg-surface-bright rounded transition-colors group">
            <ArrowLeft className="w-4 h-4 text-text-muted group-hover:text-white" />
          </Link>
          <div className="hidden md:block font-bold truncate text-white">Sector 7 Run</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 hidden md:block">
          <div className="mb-4 label-caps text-text-muted flex items-center gap-2">
            <Users className="w-3 h-3" /> Connected Nodes
          </div>
          <div className="space-y-1">
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-surface-bright transition-colors cursor-pointer border border-transparent hover:border-border-subtle group">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded flex items-center justify-center border ${p.role === 'GM' ? 'border-primary/50 text-primary bg-primary/10' : 'border-secondary/50 text-secondary bg-secondary/10'}`}>
                    {p.role === "GM" ? <Shield className="w-3 h-3" /> : <Hexagon className="w-3 h-3" />}
                  </div>
                  <div>
                    <div className="font-medium text-white group-hover:text-secondary transition-colors">{p.name}</div>
                  </div>
                </div>
                
                {/* Network Telemetry */}
                <div className="flex items-center gap-1.5 font-telemetry text-[10px] text-text-muted">
                  {p.ping}ms
                  <div className={`w-1.5 h-1.5 rounded-full ${getPingColor(p.ping)}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle flex justify-center md:justify-start gap-2">
          <button className="p-2 hover:bg-surface-bright rounded transition-colors text-text-muted hover:text-white border border-transparent hover:border-border-subtle">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Center Canvas Area (Layer 0 & 1) */}
      <main className="flex-1 relative bg-background">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center opacity-30">
            <div className="w-64 h-64 border border-border-subtle rounded-full flex items-center justify-center mb-4 mx-auto layer-1-well relative">
              <Activity className="w-16 h-16 text-text-muted absolute animate-pulse" />
            </div>
            <p className="font-telemetry text-text-muted">AWAITING_SCENE_DATA...</p>
          </div>
        </div>
        
        {/* Grid Overlay Placeholder */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
             style={{ backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
      </main>

      {/* Right Sidebar - Chat & Log (Layer 2) */}
      <aside className="w-[340px] layer-2-dock flex flex-col z-20">
        <div className="p-4 border-b border-border-subtle flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-secondary" />
          <span className="font-semibold text-white">Event Log</span>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <span className={`text-[11px] font-medium ${msg.type === 'system' || msg.type === 'system-alert' ? 'text-secondary font-telemetry uppercase tracking-wider' : 'text-text-muted'}`}>
                  {msg.sender}
                </span>
                <span className="text-[10px] text-text-muted/50 font-telemetry">{msg.timestamp}</span>
              </div>
              
              {/* Conditional rendering based on message type */}
              {msg.type === 'chat' && (
                <div className="bg-surface-base border border-border-subtle p-3 rounded text-text-base">
                  {msg.text}
                </div>
              )}
              
              {msg.type === 'system' && (
                <div className="text-secondary text-[12px] px-1 font-telemetry">
                  &gt; {msg.text}
                </div>
              )}

              {msg.type === 'system-alert' && (
                <div className="text-danger text-[12px] px-1 font-telemetry glow-danger">
                  &gt; [ALERT] {msg.text}
                </div>
              )}

              {msg.type === 'roll' && (
                <div className="bg-surface-base border border-primary/30 rounded p-0 overflow-hidden flex flex-col">
                  <div className="bg-primary/10 px-3 py-1.5 border-b border-primary/20 flex justify-between items-center text-[11px]">
                    <span className="text-text-muted">SKILL CHECK</span>
                    <span className="font-telemetry text-text-muted">{msg.formula}</span>
                  </div>
                  <div className="p-4 flex items-center justify-center">
                    <span className="text-2xl font-bold font-display text-white">{msg.result}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-border-subtle layer-1-well">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Transmit message or /roll..."
              className="w-full bg-surface-base border border-border-subtle rounded pl-3 pr-20 py-2.5 focus:outline-none focus:border-secondary transition-colors text-white placeholder:text-text-muted/40 text-[13px] font-telemetry"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button className="p-1.5 rounded hover:bg-surface-bright text-text-muted hover:text-primary transition-colors">
                <Dices className="w-4 h-4" />
              </button>
              <button className="p-1.5 bg-surface-bright border border-border-subtle hover:bg-secondary/20 hover:border-secondary/50 hover:text-secondary text-text-muted rounded transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

    </div>
  );
}
