import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { Socket } from "node:net";

// Minimal WebSocket server for tests: completes the RFC 6455 handshake, counts
// raw chunks received from clients and answers close frames. Sigil has no `ws`
// dependency.
export type FakeWebSocketServer = {
  readonly port: number;
  readonly receivedChunks: number;
  close: () => Promise<void>;
};

export const createWebSocketServer = async (port = 0): Promise<FakeWebSocketServer> => {
  const sockets = new Set<Socket>();
  let receivedChunks = 0;
  const server: Server = createServer();

  server.on("upgrade", (request, socket: Socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    const accept = createHash("sha1")
      .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.on("data", (chunk: Buffer) => {
      receivedChunks++;
      // Answer a close frame (opcode 0x8) so the client can finish its closing handshake.
      if (((chunk[0] ?? 0) & 0x0f) === 0x8) {
        socket.end(Buffer.from([0x88, 0x00]));
      }
    });
  });

  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP address");
  }

  return {
    port: address.port,
    get receivedChunks() {
      return receivedChunks;
    },
    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }

      server.close();
      await once(server, "close");
    },
  };
};
