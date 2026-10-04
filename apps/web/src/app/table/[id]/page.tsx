"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Users, Settings, Dices, Send, Shield, Hexagon, Activity } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { fetchApi } from "@/lib/api";
import { parseDiceExpression, rollExpression, type ParsedDiceExpression } from "@/lib/dice";
import { DiceRollerWindow } from "@/components/dice/DiceRollerWindow";
import { DiceRollCard } from "@/components/dice/DiceRollCard";
import { SignalingClient, PeerConnectionManager } from "@questdreamer/webrtc";
import type { ChatMessage, DataChannelMessage, DiceRoll } from "@questdreamer/types";

interface PeerState {
  peerId: string;
  displayName: string;
  isHost: boolean;
  ping: number;
}

interface ChatLogMessage {
  id: string;
  sender: string;
  text: string;
  type: "system" | "chat" | "system-alert" | "roll";
  timestamp: string;
  roll?: DiceRoll;
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
            client.joinRoom(userDisplayName, isHost);
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
        type: "chat",
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
      timestamp: Date.now()
    };

    // Add to own UI
    setChatHistory(prev => [...prev, {
      id: msgPayload.id,
      sender: msgPayload.senderName,
      text: msgPayload.content,
      type: "chat",
      timestamp: formatTime(msgPayload.timestamp)
    }]);

    sendP2P({ type: "chat", payload: msgPayload });

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
        <div className="p-4 border-b border-border-subtle flex items-center gap-3">
          <Link href="/" className="p-1.5 hover:bg-surface-bright rounded transition-colors group">
            <ArrowLeft className="w-4 h-4 text-text-muted group-hover:text-white" />
          </Link>
          <div className="hidden md:block font-bold truncate text-white">
            {campaign ? campaign.name : "Loading..."}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 hidden md:block">
          <div className="mb-4 label-caps text-text-muted flex items-center gap-2">
            <Users className="w-3 h-3" /> Connected Nodes
          </div>
          <div className="space-y-1">
            {/* Show ourselves first */}
            {user && (
              <div className="flex items-center justify-between p-2 rounded bg-surface-bright border border-border-subtle group">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded flex items-center justify-center border ${(campaign?.ownerId === user.id) ? 'border-primary/50 text-primary bg-primary/10' : 'border-secondary/50 text-secondary bg-secondary/10'}`}>
                    {(campaign?.ownerId === user.id) ? <Shield className="w-3 h-3" /> : <Hexagon className="w-3 h-3" />}
                  </div>
                  <div>
                    <div className="font-medium text-white">{user.displayName} (You)</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show other peers */}
            {peers.map((p) => (
              <div key={p.peerId} className="flex items-center justify-between p-2 rounded hover:bg-surface-bright transition-colors cursor-pointer border border-transparent hover:border-border-subtle group">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded flex items-center justify-center border ${p.isHost ? 'border-primary/50 text-primary bg-primary/10' : 'border-secondary/50 text-secondary bg-secondary/10'}`}>
                    {p.isHost ? <Shield className="w-3 h-3" /> : <Hexagon className="w-3 h-3" />}
                  </div>
                  <div>
                    <div className="font-medium text-white group-hover:text-secondary transition-colors truncate max-w-[100px]">{p.displayName}</div>
                  </div>
                </div>
                
                {/* Network Telemetry */}
                <div className="flex items-center gap-1.5 font-telemetry text-[10px] text-text-muted">
                  {p.ping > 0 ? `${p.ping}ms` : 'CONN'}
                  <div className={`w-1.5 h-1.5 rounded-full ${getPingColor(p.ping)}`} />
                </div>
              </div>
            ))}
          </div>
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

              {msg.type === 'roll' && msg.roll && <DiceRollCard roll={msg.roll} />}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-border-subtle layer-1-well">
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

    </div>
  );
}
