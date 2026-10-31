import { once } from "node:events";
import { createServer, type Server } from "node:net";

import { expect, test } from "vite-plus/test";

import { isDevToolsReachable } from "#/is-devtools-reachable.ts";

import { createWebSocketServer } from "./helpers/websocket-server.ts";

const listen = async (server: Server): Promise<number> => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP address");
  }

  return address.port;
};

test("resolves true when a WebSocket server accepts the connection", async () => {
  const server = await createWebSocketServer();

  expect(await isDevToolsReachable(`ws://127.0.0.1:${server.port}`)).toBe(true);

  await server.close();
});

test("resolves false when the connection is refused", async () => {
  const server = createServer((socket) => {
    socket.destroy();
  });
  const port = await listen(server);

  expect(await isDevToolsReachable(`ws://127.0.0.1:${port}`)).toBe(false);

  server.close();
});

test("resolves false when the server never completes the handshake", async () => {
  const server = createServer((socket) => {
    socket.on("error", () => {});
  });
  const port = await listen(server);

  expect(await isDevToolsReachable(`ws://127.0.0.1:${port}`, 200)).toBe(false);

  server.close();
});
