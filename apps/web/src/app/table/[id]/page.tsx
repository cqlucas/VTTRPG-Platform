"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Users, Settings, Dices, Send, Shield, Hexagon, Activity, MoreVertical, Mail, Book, FileText, Maximize2, Minimize2, Save, FileBox } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { fetchApi } from "@/lib/api";
import { parseDiceExpression, rollExpression, type ParsedDiceExpression } from "@/lib/dice";
import { DiceRollerWindow } from "@/components/dice/DiceRollerWindow";
import { DiceRollCard } from "@/components/dice/DiceRollCard";
import { DraggableModal } from "@/components/DraggableModal";
import { SignalingClient, PeerConnectionManager } from "@questdreamer/webrtc";
import type { ChatMessage, DataChannelMessage, DiceRoll } from "@questdreamer/types";

interface PeerState {
  peerId: string;
  displayName: string;
  isHost: boolean;
  ping: number;
  avatarUrl?: string;
}

interface ChatLogMessage {
  id: string;
  sender: string;
  text: string;
  type: "system" | "chat" | "system-alert" | "roll" | "dm-received" | "dm-sent";
  timestamp: string;
  roll?: DiceRoll;
  recipient?: string;
}

export default function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = use(params);
  const { user } = useAuth();
  
  const [campaign, setCampaign] = useState<any>(null);
  const [error, setError] = useState("");
  
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatLogMessage[]>([
    { id: "sys-0", sender: "System", text: "Initializing node link...", type: "system", timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ]);
  
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dmTarget, setDmTarget] = useState<PeerState | null>(null);
  const [openMenuPeer, setOpenMenuPeer] = useState<string | null>(null);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  
  // -- REAL STATES --
  const isDM = campaign?.ownerId === user?.id;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"nodes" | "compendium" | "ficha">("nodes");
  const [isCompendiumPopped, setIsCompendiumPopped] = useState(false);
  const [isFichaPopped, setIsFichaPopped] = useState(false);
  const [fichaTargetName, setFichaTargetName] = useState<string>("");
  
  const closeDice = useCallback(() => setIsDiceOpen(false), []);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Keep the log pinned to the newest entry
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatHistory.length]);
  
  // Refs to hold the WebRTC managers so we can access them in callbacks
  const signalingRef = useRef<SignalingClient | null>(null);
  const pcManagerRef = useRef<PeerConnectionManager | null>(null);

  const userId = user?.id;
  const userDisplayName = user?.displayName;

  useEffect(() => {
    if (!userId || !userDisplayName) return;

    // Each effect run owns its own clients. They are NOT shared through refs
    // inside callbacks, so a stale run can never hijack the active connection.
    let cancelled = false;
    let sigClient: SignalingClient | null = null;
    let pcm: PeerConnectionManager | null = null;

    // Fetch campaign details first
    const init = async () => {
      try {
        const camp = await fetchApi(`/campaigns/${campaignId}`);
        // Effect was cleaned up while fetching (Strict Mode / re-render): abort
        if (cancelled) return;
        setCampaign(camp);
        const isHost = camp.ownerId === userId;

        // Initialize Signaling
        const client: SignalingClient = new SignalingClient({
          url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
          token: localStorage.getItem("accessToken") || "",
          campaignId: campaignId,
          onSignalReceived: async (msg) => {
            // Use THIS run's PCM, never a shared ref
            if (!pcm) return;
            
            if (msg.type === "offer") {
              await pcm.handleOffer(msg.fromPeerId, msg.sdp);
            } else if (msg.type === "answer") {
              await pcm.handleAnswer(msg.fromPeerId, msg.sdp);
            } else if (msg.type === "ice-candidate") {
              await pcm.handleIceCandidate(msg.fromPeerId, msg.candidate);
            }
          },
          onDisconnected: () => {
            // Our peerId (socket.id) changes on reconnect, so old P2P links are invalid
            pcm?.destroy();
            if (pcManagerRef.current === pcm) pcManagerRef.current = null;
            pcm = null;
            setPeers([]);
          },
          onConnected: (localPeerId) => {
            if (cancelled) return;
            console.log("Connected to signaling, localPeerId:", localPeerId);

            // On reconnect, tear down any previous manager bound to the old peerId
            pcm?.destroy();

            // Initialize PeerConnectionManager BEFORE joining so it's ready for peers-list
            const newPcm = new PeerConnectionManager(
              {
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
                onSignalSend: (msg) => client.sendSignal(msg),
                onMessage: (peerId, message) => handleDataChannelMessage(peerId, message),
                onPeerConnected: (peerId) => {
                  setChatHistory(prev => [...prev, {
                    id: Date.now().toString(),
                    sender: "System",
                    text: `Peer ${peerId.substring(0, 4)} established secure connection.`,
                    type: "system",
                    timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                  }]);
                },
                onPeerDisconnected: (peerId) => {
                  setChatHistory(prev => [...prev, {
                    id: Date.now().toString(),
                    sender: "System",
                    text: `Peer ${peerId.substring(0, 4)} connection lost.`,
                    type: "system-alert",
                    timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                  }]);
                }
              },
              isHost,
              campaignId,
              localPeerId
            );
            pcm = newPcm;
            pcManagerRef.current = newPcm;

            // Announce presence (after PCM is ready to handle the peers-list reply)
            client.joinRoom(userDisplayName, isHost, user.avatarUrl);
          }
        });
        sigClient = client;
        signalingRef.current = client;

        // Handle Room Events
        client.onPeersList(({ peers: roomPeers }) => {
          // Server snapshot is authoritative: replace (dedup by peerId just in case)
          const unique = new Map(roomPeers.map(p => [p.peerId, { ...p, ping: 0 }]));
          setPeers(Array.from(unique.values()));
          
          // If we are a PLAYER, connect to the HOST automatically
          if (!isHost) {
            const hostPeers = roomPeers.filter(p => p.isHost);
            for (const hostPeer of hostPeers) {
              if (pcm) {
                setChatHistory(prev => {
                  if (prev.some(m => m.text.includes("Host located"))) return prev;
                  return [...prev, {
                    id: Date.now().toString() + "-host",
                    sender: "System",
                    text: "Host located. Initiating P2P handshake...",
                    type: "system",
                    timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                  }];
                });
                pcm.createOffer(hostPeer.peerId).catch(console.error);
              }
            }
          }
        });

        client.onPeerJoined((peer) => {
          setPeers(prev => {
            // Prevent duplicate peer entries
            if (prev.some(p => p.peerId === peer.peerId)) return prev;
            return [...prev, { ...peer, ping: 0 }];
          });
          
          // If we are a player and the host just joined, connect to them!
          if (!isHost && peer.isHost && pcm) {
            setChatHistory(prev => {
              if (prev.some(m => m.text.includes("Host located"))) return prev;
              return [...prev, {
                id: Date.now().toString() + "-host-join",
                sender: "System",
                text: "Host located. Initiating P2P handshake...",
                type: "system",
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
              }];
            });
            pcm.createOffer(peer.peerId).catch(console.error);
          }
        });

        client.onPeerLeft(({ peerId }) => {
          setPeers(prev => prev.filter(p => p.peerId !== peerId));
        });
        
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load campaign");
      }
    };

    init();

    return () => {
      cancelled = true;
      // Destroy THIS run's instances (refs may already point to a newer run)
      pcm?.destroy();
      pcm = null;
      if (sigClient) {
        sigClient.leaveRoom();
        sigClient.disconnect();
      }
      if (signalingRef.current === sigClient) signalingRef.current = null;
      pcManagerRef.current = null;
      setPeers([]);
    };
  }, [campaignId, userId, userDisplayName]);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleDataChannelMessage = (fromPeerId: string, message: DataChannelMessage) => {
    if (message.type === "chat") {
      setChatHistory(prev => [...prev, {
        id: message.payload.id,
        sender: message.payload.senderName,
        text: message.payload.content,
        type: message.payload.isWhisper ? "dm-received" : "chat",
        timestamp: formatTime(message.payload.timestamp)
      }]);
    } else if (message.type === "dice-roll") {
      const roll = message.payload;
      setChatHistory(prev => {
        if (prev.some(m => m.id === roll.id)) return prev;
        return [...prev, {
          id: roll.id,
          sender: roll.rollerName,
          text: `${roll.formula} = ${roll.total}`,
          type: "roll",
          timestamp: formatTime(roll.timestamp),
          roll,
        }];
      });
    }
    // More message handlers will go here (tokens, etc)
  };

  /** Sends a message over P2P according to our role (host broadcasts, player → host) */
  const sendP2P = (wrapper: DataChannelMessage) => {
    const pcm = pcManagerRef.current;
    if (!pcm || !user) return;
    const isHost = campaign?.ownerId === user.id;
    if (isHost) {
      pcm.broadcast(wrapper);
    } else {
      // The player only has one WebRTC connection (to the host),
      // so we use the robust sendToHost method that bypasses React state
      pcm.sendToHost(wrapper);
    }
  };

  const performRoll = (expr: ParsedDiceExpression) => {
    if (!user) return;
    const rolled = rollExpression(expr);
    const roll: DiceRoll = {
      id: `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rollerId: user.id,
      rollerName: user.displayName,
      formula: rolled.formula,
      results: rolled.results,
      groups: rolled.groups,
      modifier: rolled.modifier,
      total: rolled.total,
      timestamp: Date.now(),
    };

    setChatHistory(prev => [...prev, {
      id: roll.id,
      sender: roll.rollerName,
      text: `${roll.formula} = ${roll.total}`,
      type: "roll",
      timestamp: formatTime(roll.timestamp),
      roll,
    }]);

    sendP2P({ type: "dice-roll", payload: roll });
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !user) return;

    // A message that is ONLY a dice expression ("1d4 + 2d8 - 1", "/roll d20") is a roll
    const diceExpr = parseDiceExpression(chatMessage);
    if (diceExpr) {
      performRoll(diceExpr);
      setChatMessage("");
      return;
    }

    const msgPayload: ChatMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      senderName: user.displayName,
      content: chatMessage,
      timestamp: Date.now(),
      isWhisper: dmTarget !== null,
      whisperTargetId: dmTarget?.peerId
    };

    // Add to own UI
    if (dmTarget) {
      setChatHistory(prev => [...prev, {
        id: msgPayload.id,
        sender: user.displayName,
        recipient: dmTarget.displayName,
        text: msgPayload.content,
        type: "dm-sent",
        timestamp: formatTime(msgPayload.timestamp)
      }]);
      sendP2P({ type: "chat", payload: msgPayload });
    } else {
      setChatHistory(prev => [...prev, {
        id: msgPayload.id,
        sender: msgPayload.senderName,
        text: msgPayload.content,
        type: "chat",
        timestamp: formatTime(msgPayload.timestamp)
      }]);
      sendP2P({ type: "chat", payload: msgPayload });
    }

    setChatMessage("");
  };

  const isDiceInput = parseDiceExpression(chatMessage) !== null;

  const getPingColor = (ping: number) => {
    if (ping === 0) return "bg-primary"; // connecting/unknown
    if (ping < 50) return "bg-success";
    if (ping < 120) return "bg-primary";
    return "bg-danger";
  };

  if (error) {
    return <div className="flex items-center justify-center h-screen bg-background text-danger">{error}</div>;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-[13px]">
      
      {/* Left Sidebar - Navigation & Players (Layer 2) */}
      <aside className="w-16 md:w-64 layer-2-dock flex flex-col z-20">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="p-1.5 hover:bg-surface-bright rounded transition-colors group shrink-0">
              <ArrowLeft className="w-4 h-4 text-text-muted group-hover:text-white" />
            </Link>
            <div className="hidden md:block font-bold truncate text-white">
              {campaign ? campaign.name : "Loading..."}
            </div>
          </div>
          {isDM && (
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded text-text-muted hover:text-white hover:bg-surface-bright transition-colors shrink-0"
              title="Configurações da Mesa"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* TABS */}
        <div className="hidden md:flex items-center border-b border-border-subtle bg-surface-base">
          <button 
            onClick={() => setSidebarTab("nodes")}
            className={`flex-1 flex justify-center py-2.5 transition-colors ${sidebarTab === "nodes" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-text-muted hover:text-white hover:bg-surface-bright"}`}
            title="Nós (Jogadores)"
          >
            <Users className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              setSidebarTab(isDM ? "compendium" : "ficha");
              if (isDM) setIsCompendiumPopped(false);
              else setIsFichaPopped(false);
            }}
            className={`flex-1 flex justify-center py-2.5 transition-colors ${sidebarTab === (isDM ? "compendium" : "ficha") ? "text-secondary border-b-2 border-secondary bg-secondary/5" : "text-text-muted hover:text-white hover:bg-surface-bright"}`}
            title={isDM ? "Compêndio" : "Sua Ficha"}
          >
            {isDM ? <Book className="w-4 h-4" /> : <FileBox className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 hidden md:flex flex-col relative">
          
          {/* TAB CONTENT: NODES */}
          {sidebarTab === "nodes" && (
            <div className="space-y-1">
              {/* Show ourselves first */}
              {user && (
                <div className="flex items-center justify-between p-2 rounded bg-surface-bright border border-border-subtle group relative">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded flex items-center justify-center border overflow-hidden ${(campaign?.ownerId === user.id) ? 'border-primary/50 text-primary bg-primary/10' : 'border-secondary/50 text-secondary bg-secondary/10'}`}>
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        (campaign?.ownerId === user.id) ? <Shield className="w-3 h-3" /> : <Hexagon className="w-3 h-3" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">{user.displayName} (You)</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show other peers */}
              {peers.map((p) => (
                <div key={p.peerId} className="flex items-center justify-between p-2 rounded hover:bg-surface-bright transition-colors cursor-pointer border border-transparent hover:border-border-subtle group relative">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded flex items-center justify-center border overflow-hidden ${p.isHost ? 'border-primary/50 text-primary bg-primary/10' : 'border-secondary/50 text-secondary bg-secondary/10'}`}>
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                      ) : (
                        p.isHost ? <Shield className="w-3 h-3" /> : <Hexagon className="w-3 h-3" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white group-hover:text-secondary transition-colors truncate max-w-[100px]">{p.displayName}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 font-telemetry text-[10px] text-text-muted group-hover:hidden">
                      {p.ping > 0 ? `${p.ping}ms` : 'CONN'}
                      <div className={`w-1.5 h-1.5 rounded-full ${getPingColor(p.ping)}`} />
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuPeer(openMenuPeer === p.peerId ? null : p.peerId);
                      }}
                      className="hidden group-hover:flex items-center justify-center p-1 rounded hover:bg-surface-base text-text-muted hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
  
                  {openMenuPeer === p.peerId && (
                    <div className="absolute right-2 top-8 z-50 w-40 bg-surface-base border border-border-subtle rounded shadow-xl py-1 overflow-hidden">
                      {!p.isHost && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFichaTargetName(p.displayName);
                            setIsFichaPopped(true);
                            setOpenMenuPeer(null);
                          }}
                          className="w-full text-left px-3 py-2 text-[12px] text-text-muted hover:text-white hover:bg-surface-bright transition-colors flex items-center gap-2"
                        >
                          <FileText className="w-3.5 h-3.5" /> 
                          Visualizar Ficha
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDmTarget(p);
                          setOpenMenuPeer(null);
                        }}
                        className="w-full text-left px-3 py-2 text-[12px] text-text-muted hover:text-white hover:bg-surface-bright transition-colors flex items-center gap-2"
                      >
                        <Mail className="w-3.5 h-3.5" /> 
                        Enviar DM
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB CONTENT: COMPENDIUM */}
          {sidebarTab === "compendium" && (
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <span className="text-text-muted font-medium text-[12px]">Biblioteca</span>
                <button 
                  onClick={() => {
                    setIsCompendiumPopped(true);
                    setSidebarTab("nodes");
                  }}
                  className="p-1 hover:bg-surface-bright rounded text-text-muted hover:text-white transition-colors"
                  title="Desencaixar Compêndio"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted/50 text-[11px] text-center px-4 border border-dashed border-border-subtle rounded">
                <Book className="w-8 h-8 mb-2 opacity-20" />
                Navegue pelos seus arquivos e anotações aqui.
              </div>
            </div>
          )}

          {/* TAB CONTENT: FICHA */}
          {sidebarTab === "ficha" && (
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <span className="text-text-muted font-medium text-[12px]">Sua Ficha</span>
                <button 
                  onClick={() => {
                    setIsFichaPopped(true);
                    setFichaTargetName(user?.displayName || "");
                    setSidebarTab("nodes");
                  }}
                  className="p-1 hover:bg-surface-bright rounded text-text-muted hover:text-white transition-colors"
                  title="Desencaixar Ficha"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted/50 text-[11px] text-center px-4 border border-dashed border-border-subtle rounded">
                <FileBox className="w-8 h-8 mb-2 opacity-20" />
                Sua ficha de personagem será exibida aqui.
              </div>
            </div>
          )}
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
          {chatHistory.map((msg, i) => (
            <div key={msg.id + i} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <span className={`text-[11px] font-medium ${msg.type === 'system' || msg.type === 'system-alert' ? 'text-secondary font-telemetry uppercase tracking-wider' : 'text-text-muted'}`}>
                  {msg.sender}
                </span>
                <span className="text-[10px] text-text-muted/50 font-telemetry">{msg.timestamp}</span>
              </div>
              
              {msg.type === 'chat' && (
                <div className="bg-surface-base border border-border-subtle p-3 rounded text-text-base break-words">
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

              {msg.type === 'dm-received' && (
                <div className="bg-indigo-950/30 border-l-2 border-indigo-500 p-2.5 rounded text-text-base break-words">
                  <div className="text-[10px] font-telemetry text-indigo-400 mb-1">
                    DM &lt; from {msg.sender}
                  </div>
                  <div className="text-white/90">{msg.text}</div>
                </div>
              )}

              {msg.type === 'dm-sent' && (
                <div className="bg-slate-900/50 border-l-2 border-slate-500 p-2.5 rounded text-text-base break-words">
                  <div className="text-[10px] font-telemetry text-slate-400 mb-1">
                    DM &gt; to {msg.recipient}
                  </div>
                  <div className="text-white/80">{msg.text}</div>
                </div>
              )}

              {msg.type === 'roll' && msg.roll && <DiceRollCard roll={msg.roll} />}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-border-subtle layer-1-well flex flex-col gap-2">
          
          {/* DM Target Selector */}
          <div className="relative self-start">
            <button 
              type="button"
              onClick={() => setIsTargetDropdownOpen(!isTargetDropdownOpen)}
              className="text-[10px] font-telemetry uppercase bg-surface-bright hover:bg-surface-base border border-border-subtle px-2 py-1 rounded text-text-muted hover:text-white transition-colors flex items-center gap-1"
            >
              {dmTarget ? `[Para: ${dmTarget.displayName}]` : "[Para: Toda a mesa]"}
            </button>
            
            {isTargetDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-1 z-50 w-48 bg-surface-base border border-border-subtle rounded shadow-xl py-1 max-h-48 overflow-y-auto">
                <button 
                  type="button"
                  onClick={() => { setDmTarget(null); setIsTargetDropdownOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-text-muted hover:text-white hover:bg-surface-bright transition-colors"
                >
                  [ Toda a mesa ]
                </button>
                {peers.map(p => (
                  <button 
                    key={p.peerId}
                    type="button"
                    onClick={() => { setDmTarget(p); setIsTargetDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-muted hover:text-white hover:bg-surface-bright transition-colors truncate flex items-center gap-2"
                  >
                    <Users className="w-3 h-3 opacity-50" /> {p.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={sendChatMessage} className="relative">
            <input 
              id="chat-input"
              type="text" 
              placeholder="Transmit message or 1d20 + 3..."
              className={`w-full bg-surface-base border rounded pl-3 pr-20 py-2.5 focus:outline-none transition-colors text-white placeholder:text-text-muted/40 text-[13px] font-telemetry ${
                isDiceInput ? 'border-primary/60 focus:border-primary' : 'border-border-subtle focus:border-secondary'
              }`}
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                id="dice-toggle-btn"
                type="button"
                onClick={() => setIsDiceOpen(o => !o)}
                title="Dice roller"
                aria-pressed={isDiceOpen}
                className={`p-1.5 rounded transition-colors ${
                  isDiceOpen || isDiceInput ? 'text-primary bg-primary/10' : 'hover:bg-surface-bright text-text-muted hover:text-primary'
                }`}
              >
                <Dices className="w-4 h-4" />
              </button>
              <button id="chat-send-btn" type="submit" className="p-1.5 bg-surface-bright border border-border-subtle hover:bg-secondary/20 hover:border-secondary/50 hover:text-secondary text-text-muted rounded transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </aside>

      <DiceRollerWindow open={isDiceOpen} onClose={closeDice} onRoll={performRoll} />

      <DraggableModal 
        id="settings-modal"
        title="Configurações da Mesa"
        icon={<Settings className="w-4 h-4 text-primary" />}
        open={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        width={400}
      >
        <div className="p-4 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-telemetry uppercase text-text-muted mb-1">Nome da Mesa</label>
            <input type="text" className="w-full bg-background border border-border-subtle rounded px-3 py-2 text-white text-[13px]" defaultValue={campaign?.name || "Mesa de RPG"} />
          </div>
          <div>
            <label className="block text-[11px] font-telemetry uppercase text-text-muted mb-1">Visibilidade</label>
            <select className="w-full bg-background border border-border-subtle rounded px-3 py-2 text-white text-[13px]">
              <option>Privada</option>
              <option>Pública</option>
            </select>
          </div>
          <button className="bg-primary hover:brightness-110 text-background font-semibold text-[13px] py-2 rounded transition-colors flex items-center justify-center gap-2 mt-2">
            <Save className="w-4 h-4" />
            Salvar Configurações
          </button>
        </div>
      </DraggableModal>

      <DraggableModal 
        id="compendium-modal"
        title="Biblioteca (Compêndio)"
        icon={<Book className="w-4 h-4 text-secondary" />}
        open={isCompendiumPopped} 
        onClose={() => setIsCompendiumPopped(false)}
        width={450}
        initialHeight={500}
        headerActions={
          <button onClick={() => { setIsCompendiumPopped(false); setSidebarTab("compendium"); }} className="p-1.5 rounded text-text-muted hover:text-secondary hover:bg-secondary/10 transition-colors" title="Reencaixar">
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="flex-1 h-full min-h-[300px] flex flex-col items-center justify-center text-text-muted/50 text-[11px] text-center p-6 border-2 border-dashed border-border-subtle rounded m-4">
          <Book className="w-12 h-12 mb-3 opacity-20" />
          Navegue pelos seus arquivos e anotações aqui.<br/>
          (Componente desencaixado)
        </div>
      </DraggableModal>

      <DraggableModal 
        id="ficha-modal"
        title={`Ficha: ${fichaTargetName}`}
        icon={<FileBox className="w-4 h-4 text-secondary" />}
        open={isFichaPopped} 
        onClose={() => setIsFichaPopped(false)}
        width={500}
        initialHeight={600}
        headerActions={
          !isDM && fichaTargetName === user?.displayName ? (
            <button onClick={() => { setIsFichaPopped(false); setSidebarTab("ficha"); }} className="p-1.5 rounded text-text-muted hover:text-secondary hover:bg-secondary/10 transition-colors" title="Reencaixar">
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          ) : null
        }
      >
        <div className="flex-1 h-full min-h-[300px] flex flex-col items-center justify-center text-text-muted/50 text-[11px] text-center p-6 border-2 border-dashed border-border-subtle rounded m-4">
          <FileBox className="w-12 h-12 mb-3 opacity-20" />
          Ficha de personagem de {fichaTargetName} será exibida aqui.<br/>
          (Componente desencaixado)
        </div>
      </DraggableModal>

    </div>
  );
}
