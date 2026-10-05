import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Namespace, Server, Socket } from "socket.io";
import type {
  SignalOffer,
  SignalAnswer,
  SignalIceCandidate,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@questdreamer/types";

interface RoomPeer {
  socketId: string;
  peerId: string;
  displayName: string;
  isHost: boolean;
  avatarUrl?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  },
  namespace: "/signaling",
})
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  /** Map of campaignId → Set of peers in the room */
  private rooms = new Map<string, Map<string, RoomPeer>>();

  /** Map of socketId → { campaignId, peerId } for cleanup on disconnect */
  private socketToPeer = new Map<
    string,
    { campaignId: string; peerId: string }
  >();

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
    const peerInfo = this.socketToPeer.get(client.id);
    if (peerInfo) {
      this.removePeerFromRoom(peerInfo.campaignId, peerInfo.peerId, client);
      this.socketToPeer.delete(client.id);
    }
  }

  @SubscribeMessage("room:join")
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { campaignId: string; peerId: string; displayName: string; isHost: boolean; avatarUrl?: string },
  ) {
    const { campaignId, displayName, isHost, avatarUrl } = payload;
    // The socket id is the authoritative peer id (never trust the client payload)
    const peerId = client.id;
    console.log(`📥 ${displayName} (${peerId}) joining room ${campaignId} [Host: ${isHost}]`);

    // If this socket was already registered (re-join / room switch), drop the old entry first
    const previous = this.socketToPeer.get(client.id);
    if (previous) {
      this.removePeerFromRoom(previous.campaignId, previous.peerId, client);
      this.socketToPeer.delete(client.id);
    }

    // Join the Socket.io room for broadcasting
    client.join(campaignId);

    // Track the peer
    if (!this.rooms.has(campaignId)) {
      this.rooms.set(campaignId, new Map());
    }
    const room = this.rooms.get(campaignId)!;

    // Purge stale entries whose sockets are no longer connected
    // (with a namespaced gateway, Nest injects a Namespace whose `sockets` is a Map)
    const liveSockets = (this.server as unknown as Namespace).sockets;
    for (const [id, p] of room) {
      if (!liveSockets.has(p.socketId)) {
        room.delete(id);
        this.socketToPeer.delete(p.socketId);
        this.server.to(campaignId).emit("room:peer-left", { peerId: id });
      }
    }

    room.set(peerId, { socketId: client.id, peerId, displayName, isHost, avatarUrl });

    this.socketToPeer.set(client.id, { campaignId, peerId });

    // Notify existing peers about the new joiner
    client.to(campaignId).emit("room:peer-joined", { peerId, displayName, isHost, avatarUrl });

    // Send the list of existing peers to the new joiner
    const existingPeers = Array.from(room.values())
      .filter((p) => p.peerId !== peerId)
      .map((p) => ({ peerId: p.peerId, displayName: p.displayName, isHost: p.isHost, avatarUrl: p.avatarUrl }));

    client.emit("room:peers-list", { peers: existingPeers });
  }

  @SubscribeMessage("room:leave")
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { campaignId: string },
  ) {
    const peerInfo = this.socketToPeer.get(client.id);
    if (peerInfo) {
      this.removePeerFromRoom(payload.campaignId, peerInfo.peerId, client);
      this.socketToPeer.delete(client.id);
    }
  }

  // ──────────────────────────────────────────────
  // Signaling Relay — SDP & ICE
  // ──────────────────────────────────────────────

  @SubscribeMessage("signal:offer")
  handleOffer(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: SignalOffer,
  ) {
    console.log(
      `📡 Relaying offer: ${payload.fromPeerId} → ${payload.toPeerId}`,
    );
    const targetSocket = this.findSocketByPeerId(
      payload.campaignId,
      payload.toPeerId,
    );
    if (targetSocket) {
      this.server.to(targetSocket).emit("signal:offer", payload);
    }
  }

  @SubscribeMessage("signal:answer")
  handleAnswer(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: SignalAnswer,
  ) {
    console.log(
      `📡 Relaying answer: ${payload.fromPeerId} → ${payload.toPeerId}`,
    );
    const targetSocket = this.findSocketByPeerId(
      payload.campaignId,
      payload.toPeerId,
    );
    if (targetSocket) {
      this.server.to(targetSocket).emit("signal:answer", payload);
    }
  }

  @SubscribeMessage("signal:ice-candidate")
  handleIceCandidate(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: SignalIceCandidate,
  ) {
    const targetSocket = this.findSocketByPeerId(
      payload.campaignId,
      payload.toPeerId,
    );
    if (targetSocket) {
      this.server.to(targetSocket).emit("signal:ice-candidate", payload);
    }
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private findSocketByPeerId(
    campaignId: string,
    peerId: string,
  ): string | undefined {
    const room = this.rooms.get(campaignId);
    if (!room) return undefined;
    const peer = room.get(peerId);
    return peer?.socketId;
  }

  private removePeerFromRoom(
    campaignId: string,
    peerId: string,
    client: Socket,
  ) {
    const room = this.rooms.get(campaignId);
    if (room) {
      const peer = room.get(peerId);
      if (peer) {
        room.delete(peerId);
        client.leave(campaignId);
        client
          .to(campaignId)
          .emit("room:peer-left", { peerId });
        console.log(`📤 ${peerId} left room ${campaignId}`);

        // Clean up empty rooms
        if (room.size === 0) {
          this.rooms.delete(campaignId);
        }
      }
    }
  }
}
