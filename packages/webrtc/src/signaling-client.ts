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

    this.socket.on("signal", (message: SignalMessage) => {
      // Validate that the message belongs to our campaign
      if (message.campaignId === this.config.campaignId) {
        this.config.onSignalReceived(message);
      }
    });

    this.socket.on("host-joined", () => {
      if (this.config.onHostStatusChanged) {
        this.config.onHostStatusChanged(true);
      }
    });

    this.socket.on("host-left", () => {
      if (this.config.onHostStatusChanged) {
        this.config.onHostStatusChanged(false);
      }
    });

    this.socket.on("connect_error", (err) => {
      console.error(`[Signaling] Connection error: ${err.message}`);
    });
  }

  /**
   * Send a signal message (Offer, Answer, ICE) to a specific peer.
   * If `toPeerId` is "host", the server routes it to the campaign's host.
   */
  sendSignal(message: SignalMessage) {
    if (!this.socket.connected) {
      console.warn("[Signaling] Cannot send signal, socket is disconnected.");
      return;
    }
    
    // Safety check to ensure we always include the campaign ID
    message.campaignId = this.config.campaignId;
    
    this.socket.emit("signal", message);
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
