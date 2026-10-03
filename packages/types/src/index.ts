// ──────────────────────────────────────────────
// WebRTC Signaling Payloads
// ──────────────────────────────────────────────

/** Sent by a peer to initiate a connection */
export interface SignalOffer {
  type: "offer";
  fromPeerId: string;
  toPeerId: string;
  campaignId: string;
  sdp: RTCSessionDescriptionInit;
}

/** Sent by the receiving peer in response to an offer */
export interface SignalAnswer {
  type: "answer";
  fromPeerId: string;
  toPeerId: string;
  campaignId: string;
  sdp: RTCSessionDescriptionInit;
}

/** ICE candidate exchange between peers */
export interface SignalIceCandidate {
  type: "ice-candidate";
  fromPeerId: string;
  toPeerId: string;
  campaignId: string;
  candidate: RTCIceCandidateInit;
}

export type SignalMessage = SignalOffer | SignalAnswer | SignalIceCandidate;

// ──────────────────────────────────────────────
// P2P Data Channel Messages
// ──────────────────────────────────────────────

/** Token position on the VTT canvas */
export interface TokenPosition {
  tokenId: string;
  x: number;
  y: number;
  rotation?: number;
}

/** Chat message sent over P2P */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isWhisper?: boolean;
  whisperTargetId?: string;
}

/** Dice roll result sent over P2P */
export interface DiceRoll {
  id: string;
  rollerId: string;
  rollerName: string;
  formula: string;        // e.g. "2d6+3"
  results: number[];      // individual die results
  total: number;
  timestamp: number;
  isSecret?: boolean;     // GM-only roll
}

/** Types of messages sent over WebRTC Data Channels */
export type DataChannelMessage =
  | { type: "token-move"; payload: TokenPosition }
  | { type: "token-move-batch"; payload: TokenPosition[] }
  | { type: "chat"; payload: ChatMessage }
  | { type: "dice-roll"; payload: DiceRoll }
  | { type: "ping"; payload: { timestamp: number } }
  | { type: "pong"; payload: { timestamp: number } }
  | { type: "peer-joined"; payload: { peerId: string; displayName: string } }
  | { type: "peer-left"; payload: { peerId: string } }
  | { type: "state-sync"; payload: VttState }
  | { type: "entity_update"; payload: { entityType: "character" | "token" | "lore"; entityId: string; changes: any; timestamp: number } }
  | { type: "request_snapshot"; payload: Record<string, never> }
  | { type: "state_snapshot"; payload: any };

// ──────────────────────────────────────────────
// VTT State (synchronized across peers)
// ──────────────────────────────────────────────

export interface VttToken {
  id: string;
  name: string;
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  layer: "token" | "map" | "gm";
  isVisible: boolean;
  ownerId?: string;
}

export interface VttState {
  campaignId: string;
  tokens: VttToken[];
  mapImageUrl?: string;
  gridSize: number;
  gridVisible: boolean;
}

// ──────────────────────────────────────────────
// API / REST DTOs
// ──────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// ──────────────────────────────────────────────
// Signaling Server Events (Socket.io)
// ──────────────────────────────────────────────

export interface ServerToClientEvents {
  "signal:offer": (payload: SignalOffer) => void;
  "signal:answer": (payload: SignalAnswer) => void;
  "signal:ice-candidate": (payload: SignalIceCandidate) => void;
  "room:peer-joined": (payload: { peerId: string; displayName: string }) => void;
  "room:peer-left": (payload: { peerId: string }) => void;
  "room:peers-list": (payload: { peers: Array<{ peerId: string; displayName: string }> }) => void;
  "error": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "signal:offer": (payload: SignalOffer) => void;
  "signal:answer": (payload: SignalAnswer) => void;
  "signal:ice-candidate": (payload: SignalIceCandidate) => void;
  "room:join": (payload: { campaignId: string; peerId: string; displayName: string }) => void;
  "room:leave": (payload: { campaignId: string }) => void;
}
