import type { DataChannelMessage } from "@questdreamer/types";
import { PeerConnectionManager } from "./peer-connection-manager";

type SyncEventHandler = (payload: any) => void;

/**
 * High-level manager that handles packing and unpacking game state data
 * across the WebRTC P2P Data Channels.
 */
export class DataSyncManager {
  private p2p: PeerConnectionManager;
  private listeners = new Map<string, Set<SyncEventHandler>>();

  constructor(p2p: PeerConnectionManager) {
    this.p2p = p2p;
  }

  /**
   * Dispatches a raw WebRTC DataChannel message into the local event system.
   * This should be called by the onMessage callback of PeerConnectionManager.
   */
  handleIncomingMessage(peerId: string, message: DataChannelMessage) {
    const handlers = this.listeners.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        // Attach the sender's peerId to the payload context if needed
        const payloadWithContext = { ...message.payload, __senderId: peerId };
        handler(payloadWithContext);
      }
    }
  }

  /**
   * Subscribe to a specific type of sync event.
   */
  on(eventType: string, handler: SyncEventHandler) {
    let handlers = this.listeners.get(eventType);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(eventType, handlers);
    }
    handlers.add(handler);
  }

  /**
   * Unsubscribe from a specific sync event.
   */
  off(eventType: string, handler: SyncEventHandler) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Syncs an entity update (e.g., character moved, HP changed).
   * If this node is the Host, it broadcasts to all peers.
   * If this node is a Player, it sends to the Host (which will relay it).
   */
  syncEntityUpdate(entityType: "character" | "token" | "lore", entityId: string, changes: any) {
    const message: DataChannelMessage = {
      type: "entity_update",
      payload: {
        entityType,
        entityId,
        changes,
        timestamp: Date.now(),
      },
    };

    if (this.p2p.isHostNode) {
      this.p2p.broadcast(message);
    } else {
      this.p2p.send("host", message); // "host" is the designated targetPeerId for players
    }
  }

  /**
   * Request a full state snapshot from the host.
   * Usually called by a player immediately after establishing WebRTC connection.
   */
  requestStateSnapshot() {
    if (!this.p2p.isHostNode) {
      this.p2p.send("host", {
        type: "request_snapshot",
        payload: {},
      });
    }
  }

  /**
   * Send a full state snapshot to a specific peer.
   */
  sendStateSnapshot(targetPeerId: string, snapshotPayload: any) {
    if (this.p2p.isHostNode) {
      this.p2p.send(targetPeerId, {
        type: "state_snapshot",
        payload: snapshotPayload,
      });
    }
  }
}
