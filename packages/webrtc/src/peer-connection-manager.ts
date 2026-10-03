import type { DataChannelMessage, SignalMessage } from "@questdreamer/types";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

export interface PeerConnectionConfig {
  /** STUN/TURN servers for ICE */
  iceServers: RTCIceServer[];
  /** Callback to send signaling messages via the Socket.io signaling server */
  onSignalSend: (message: SignalMessage) => void;
  /** Callback when a P2P data channel message is received */
  onMessage: (peerId: string, message: DataChannelMessage) => void;
  /** Callback when a peer connects */
  onPeerConnected?: (peerId: string) => void;
  /** Callback when a peer disconnects */
  onPeerDisconnected?: (peerId: string) => void;
}

// ──────────────────────────────────────────────
// Peer Connection Manager
// ──────────────────────────────────────────────

/**
 * Manages WebRTC peer connections for a game session.
 *
 * - **Host (GM)**: Accepts incoming connections, maintains a star topology,
 *   and relays messages between all connected peers.
 * - **Peer (Player)**: Connects to the host and sends/receives messages.
 */
export class PeerConnectionManager {
  private connections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private config: PeerConnectionConfig;
  private isHost: boolean;
  private campaignId: string;
  private localPeerId: string;

  constructor(
    config: PeerConnectionConfig,
    isHost: boolean,
    campaignId: string,
    localPeerId: string
  ) {
    this.config = config;
    this.isHost = isHost;
    this.campaignId = campaignId;
    this.localPeerId = localPeerId;
  }

  private createConnection(targetPeerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.config.iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.config.onSignalSend({
          type: "ice-candidate",
          fromPeerId: this.localPeerId,
          toPeerId: targetPeerId,
          campaignId: this.campaignId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        this.config.onPeerConnected?.(targetPeerId);
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        this.cleanupConnection(targetPeerId);
      }
    };

    // If we are the Host, we expect the peer to create the data channel
    pc.ondatachannel = (event) => {
      this.setupDataChannel(targetPeerId, event.channel);
    };

    this.connections.set(targetPeerId, pc);
    return pc;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel) {
    channel.onmessage = (event) => {
      try {
        const message: DataChannelMessage = JSON.parse(event.data);
        
        // If we are the Host, relay the message to all other peers (Star Topology)
        if (this.isHost) {
          this.broadcast(message, peerId);
        }

        this.config.onMessage(peerId, message);
      } catch (err) {
        console.error("Failed to parse DataChannel message", err);
      }
    };

    channel.onclose = () => this.cleanupConnection(peerId);
    
    this.dataChannels.set(peerId, channel);
  }

  private cleanupConnection(peerId: string) {
    const pc = this.connections.get(peerId);
    if (pc) {
      pc.close();
      this.connections.delete(peerId);
    }
    
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(peerId);
    }

    this.config.onPeerDisconnected?.(peerId);
  }

  /** Create an offer to connect to a peer (called by the player connecting to host) */
  async createOffer(targetPeerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.createConnection(targetPeerId);

    // The peer initiating connection creates the Data Channel
    const dc = pc.createDataChannel("vtt-sync", {
      ordered: true,
      maxRetransmits: 3, // Reliable transport for standard sync
    });
    
    // Create a secondary channel for large file/blob transfers if needed later
    // pc.createDataChannel("vtt-files", { ordered: true });
    
    this.setupDataChannel(targetPeerId, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.config.onSignalSend({
      type: "offer",
      fromPeerId: this.localPeerId,
      toPeerId: targetPeerId,
      campaignId: this.campaignId,
      sdp: offer,
    });

    return offer;
  }

  /** Handle an incoming SDP offer (called on the host) */
  async handleOffer(fromPeerId: string, sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    let pc = this.connections.get(fromPeerId);
    if (!pc) {
      pc = this.createConnection(fromPeerId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.config.onSignalSend({
      type: "answer",
      fromPeerId: this.localPeerId,
      toPeerId: fromPeerId,
      campaignId: this.campaignId,
      sdp: answer,
    });

    return answer;
  }

  /** Handle an incoming SDP answer (called on the peer that sent the offer) */
  async handleAnswer(fromPeerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.connections.get(fromPeerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } else {
      console.warn("Received answer for unknown peer:", fromPeerId);
    }
  }

  /** Handle an incoming ICE candidate */
  async handleIceCandidate(fromPeerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.connections.get(fromPeerId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding received ICE candidate", e);
      }
    } else {
      console.warn("Received ICE candidate for unknown peer:", fromPeerId);
    }
  }

  /** Send a message to a specific peer */
  send(peerId: string, message: DataChannelMessage): void {
    const dc = this.dataChannels.get(peerId);
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(message));
    }
  }

  /** Broadcast a message to all connected peers (host only) */
  broadcast(message: DataChannelMessage, excludePeerId?: string): void {
    const data = JSON.stringify(message);
    
    for (const [peerId, dc] of this.dataChannels.entries()) {
      if (peerId !== excludePeerId && dc.readyState === "open") {
        dc.send(data);
      }
    }
  }

  /** Close all connections and clean up */
  destroy(): void {
    for (const [, dc] of this.dataChannels) {
      dc.close();
    }
    for (const [, pc] of this.connections) {
      pc.close();
    }
    this.connections.clear();
    this.dataChannels.clear();
  }

  /** Get the number of active connections */
  get peerCount(): number {
    return this.connections.size;
  }

  /** Check if acting as the host (GM) */
  get isHostNode(): boolean {
    return this.isHost;
  }
}
