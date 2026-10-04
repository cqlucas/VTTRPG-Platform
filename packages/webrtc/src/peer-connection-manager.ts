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
  private destroyed = false;

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

  private pendingMessages = new Map<string, string[]>();

  private setupDataChannel(peerId: string, channel: RTCDataChannel) {
    console.log(`[WebRTC] Setting up data channel for ${peerId}`);
    
    channel.onopen = () => {
      console.log(`[WebRTC] Data channel OPEN for ${peerId}`);
      // Flush pending messages
      const pending = this.pendingMessages.get(peerId);
      if (pending && pending.length > 0) {
        console.log(`[WebRTC] Flushing ${pending.length} pending messages for ${peerId}`);
        for (const msg of pending) {
          channel.send(msg);
        }
        this.pendingMessages.delete(peerId);
      }
    };

    channel.onmessage = (event) => {
      if (this.destroyed) return;
      try {
        const message: DataChannelMessage = JSON.parse(event.data);
        console.log(`[WebRTC] Received message from ${peerId}:`, message.type);
        
        // If we are the Host, relay the message to all other peers (Star Topology)
        if (this.isHost) {
          this.broadcast(message, peerId);
        }

        this.config.onMessage(peerId, message);
      } catch (err) {
        console.error(`[WebRTC] Failed to parse DataChannel message from ${peerId}`, err);
      }
    };

    channel.onclose = () => {
      console.log(`[WebRTC] Data channel closed for ${peerId}`);
      this.cleanupConnection(peerId);
    };
    
    this.dataChannels.set(peerId, channel);
  }

  private cleanupConnection(peerId: string) {
    const pc = this.connections.get(peerId);
    const dc = this.dataChannels.get(peerId);
    // Idempotent: pc.close() triggers dc.onclose which re-enters here
    if (!pc && !dc) return;

    this.connections.delete(peerId);
    this.dataChannels.delete(peerId);
    this.pendingMessages.delete(peerId);
    this.pendingIceCandidates.delete(peerId);

    dc?.close();
    pc?.close();

    if (!this.destroyed) {
      this.config.onPeerDisconnected?.(peerId);
    }
  }

  /** Create an offer to connect to a peer (called by the player connecting to host) */
  async createOffer(targetPeerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.createConnection(targetPeerId);

    // The peer initiating connection creates the Data Channel
    const dc = pc.createDataChannel("vtt-sync", {
      ordered: true,
      // Removed maxRetransmits to ensure 100% reliable TCP-like delivery
    });
    
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

  private negotiatingPeers = new Set<string>();
  private pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();

  /** Handle an incoming SDP offer (called on the host) */
  async handleOffer(fromPeerId: string, sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (this.negotiatingPeers.has(fromPeerId)) {
      console.warn(`[WebRTC] Ignoring concurrent offer from ${fromPeerId}`);
      return null;
    }
    
    this.negotiatingPeers.add(fromPeerId);

    try {
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

      this.flushPendingIceCandidates(fromPeerId, pc);
      return answer;
    } catch (err) {
      console.error(`[WebRTC] Failed to handle offer from ${fromPeerId}:`, err);
      return null;
    } finally {
      this.negotiatingPeers.delete(fromPeerId);
    }
  }

  /** Handle an incoming SDP answer (called on the peer that sent the offer) */
  async handleAnswer(fromPeerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.connections.get(fromPeerId);
    if (pc) {
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.flushPendingIceCandidates(fromPeerId, pc);
      } else {
        console.warn(`[WebRTC] Ignoring answer from ${fromPeerId} (state: ${pc.signalingState})`);
      }
    } else {
      console.warn("[WebRTC] Received answer for unknown peer:", fromPeerId);
    }
  }

  /** Handle an incoming ICE candidate */
  async handleIceCandidate(fromPeerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.connections.get(fromPeerId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("[WebRTC] Error adding received ICE candidate", e);
      }
    } else {
      console.log(`[WebRTC] Queuing ICE candidate for ${fromPeerId}`);
      const pending = this.pendingIceCandidates.get(fromPeerId) || [];
      pending.push(candidate);
      this.pendingIceCandidates.set(fromPeerId, pending);
    }
  }

  private async flushPendingIceCandidates(peerId: string, pc: RTCPeerConnection) {
    const pending = this.pendingIceCandidates.get(peerId);
    if (pending && pending.length > 0) {
      console.log(`[WebRTC] Flushing ${pending.length} pending ICE candidates for ${peerId}`);
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[WebRTC] Error adding pending ICE candidate", e);
        }
      }
      this.pendingIceCandidates.delete(peerId);
    }
  }

  /** Send a message to a specific peer */
  send(peerId: string, message: DataChannelMessage): void {
    const dc = this.dataChannels.get(peerId);
    const data = JSON.stringify(message);
    
    if (dc) {
      if (dc.readyState === "open") {
        dc.send(data);
      } else if (dc.readyState === "connecting") {
        const pending = this.pendingMessages.get(peerId) || [];
        pending.push(data);
        this.pendingMessages.set(peerId, pending);
      } else {
        console.warn(`[WebRTC] Cannot send to ${peerId}: readyState is ${dc.readyState}`);
      }
    } else {
      console.warn(`[WebRTC] Cannot send message: Data channel for ${peerId} not found`);
    }
  }

  /** Send a message to the host (called by players) */
  sendToHost(message: DataChannelMessage): void {
    const data = JSON.stringify(message);
    let handled = false;
    
    // First pass: send to all OPEN host connections
    for (const [peerId, dc] of this.dataChannels.entries()) {
      if (dc.readyState === "open") {
        dc.send(data);
        handled = true;
      }
    }
    
    // Second pass: if no open connections were found, queue it on CONNECTING ones
    if (!handled) {
      for (const [peerId, dc] of this.dataChannels.entries()) {
        if (dc.readyState === "connecting") {
          const pending = this.pendingMessages.get(peerId) || [];
          pending.push(data);
          this.pendingMessages.set(peerId, pending);
          handled = true;
        }
      }
    }
    
    if (!handled) {
      console.warn("[WebRTC] Cannot send message to host: No data channels available.");
    }
  }

  /** Broadcast a message to all connected peers (host only) */
  broadcast(message: DataChannelMessage, excludePeerId?: string): void {
    const data = JSON.stringify(message);
    let sentCount = 0;
    
    for (const [peerId, dc] of this.dataChannels.entries()) {
      if (peerId !== excludePeerId) {
        if (dc.readyState === "open") {
          dc.send(data);
          sentCount++;
        } else if (dc.readyState === "connecting") {
          const pending = this.pendingMessages.get(peerId) || [];
          pending.push(data);
          this.pendingMessages.set(peerId, pending);
          sentCount++;
        } else {
          console.warn(`[WebRTC] Cannot broadcast to ${peerId}: readyState is ${dc.readyState}`);
        }
      }
    }
    
    console.log(`[WebRTC] Broadcasted to ${sentCount} peers`);
  }

  /** Close all connections and clean up */
  destroy(): void {
    this.destroyed = true;
    const dcs = Array.from(this.dataChannels.values());
    const pcs = Array.from(this.connections.values());
    this.connections.clear();
    this.dataChannels.clear();
    this.pendingMessages.clear();
    this.pendingIceCandidates.clear();
    for (const dc of dcs) dc.close();
    for (const pc of pcs) pc.close();
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
