import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
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
}

/**
 * WebSocket Gateway for WebRTC Signaling.
 *
 * This gateway does NOT process game logic or movement data.
 * Its sole purpose is to relay SDP offers/answers and ICE candidates
 * between peers to establish direct P2P connections.
 *
 * Flow:
 * 1. Player joins a room (campaign) via "room:join"
 * 2. Player sends an SDP offer to the Host (GM) via "signal:offer"
 * 3. Host responds with an SDP answer via "signal:answer"
 * 4. Both exchange ICE candidates via "signal:ice-candidate"
 * 5. Once the P2P connection is established, all game data flows directly
 *    between peers — the signaling server is no longer needed.
 */
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
    payload: { campaignId: string; peerId: string; displayName: string },
  ) {
    const { campaignId, peerId, displayName } = payload;
    console.log(`📥 ${displayName} (${peerId}) joining room ${campaignId}`);

    // Join the Socket.io room for broadcasting
    client.join(campaignId);

    // Track the peer
    if (!this.rooms.has(campaignId)) {
      this.rooms.set(campaignId, new Map());
    }
    const room = this.rooms.get(campaignId)!;
    room.set(peerId, { socketId: client.id, peerId, displayName });

    this.socketToPeer.set(client.id, { campaignId, peerId });

    // Notify existing peers about the new joiner
    client.to(campaignId).emit("room:peer-joined", { peerId, displayName });

    // Send the list of existing peers to the new joiner
    const existingPeers = Array.from(room.values())
      .filter((p) => p.peerId !== peerId)
      .map((p) => ({ peerId: p.peerId, displayName: p.displayName }));

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
