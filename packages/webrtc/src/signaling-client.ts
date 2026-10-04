import { io, Socket } from "socket.io-client";
import type { SignalMessage } from "@questdreamer/types";

export interface SignalingClientConfig {
  url: string;
  token: string; // JWT token for auth
  campaignId: string;
  onSignalReceived: (message: SignalMessage) => void;
  onHostStatusChanged?: (hasHost: boolean) => void;
  onConnected?: (peerId: string) => void;
  onDisconnected?: () => void;
}

export class SignalingClient {
  private socket: Socket;
  private config: SignalingClientConfig;
  private peerId: string | null = null;

  constructor(config: SignalingClientConfig) {
    this.config = config;

    // Connect to the specific signaling namespace
    this.socket = io(`${config.url}/signaling`, {
      auth: { token: config.token },
      query: { campaignId: config.campaignId },
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on("connect", () => {
      this.peerId = this.socket.id ?? null;
      console.log(`[Signaling] Connected with peer ID: ${this.peerId}`);
      if (this.peerId && this.config.onConnected) {
        this.config.onConnected(this.peerId);
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log(`[Signaling] Disconnected: ${reason}`);
      this.peerId = null;
      if (this.config.onDisconnected) {
        this.config.onDisconnected();
      }
    });

    this.socket.on("signal:offer", (message: SignalMessage) => {
      this.config.onSignalReceived(message);
    });

    this.socket.on("signal:answer", (message: SignalMessage) => {
      this.config.onSignalReceived(message);
    });

    this.socket.on("signal:ice-candidate", (message: SignalMessage) => {
      this.config.onSignalReceived(message);
    });

    this.socket.on("connect_error", (err) => {
      console.error(`[Signaling] Connection error: ${err.message}`);
    });
  }

  joinRoom(displayName: string, isHost: boolean) {
    if (!this.peerId) return;
    this.socket.emit("room:join", { 
      campaignId: this.config.campaignId,
      peerId: this.peerId,
      displayName,
      isHost
    });
  }

  leaveRoom() {
    this.socket.emit("room:leave", { campaignId: this.config.campaignId });
  }

  onPeerJoined(cb: (payload: { peerId: string; displayName: string; isHost: boolean }) => void) {
    this.socket.on("room:peer-joined", cb);
  }

  onPeerLeft(cb: (payload: { peerId: string }) => void) {
    this.socket.on("room:peer-left", cb);
  }

  onPeersList(cb: (payload: { peers: Array<{ peerId: string; displayName: string; isHost: boolean }> }) => void) {
    this.socket.on("room:peers-list", cb);
  }

  /**
   * Send a signal message (Offer, Answer, ICE) to a specific peer.
   */
  sendSignal(message: SignalMessage) {
    if (!this.socket.connected) {
      console.warn("[Signaling] Cannot send signal, socket is disconnected.");
      return;
    }
    
    // Safety check to ensure we always include the campaign ID
    message.campaignId = this.config.campaignId;
    
    // Emit the specific event based on message type
    if (message.type === "offer") {
      this.socket.emit("signal:offer", message);
    } else if (message.type === "answer") {
      this.socket.emit("signal:answer", message);
    } else if (message.type === "ice-candidate") {
      this.socket.emit("signal:ice-candidate", message);
    }
  }

  disconnect() {
    this.socket.disconnect();
  }

  get isConnected(): boolean {
    return this.socket.connected;
  }

  get currentPeerId(): string | null {
    return this.peerId;
  }
}
