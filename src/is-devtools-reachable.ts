import { setTimeout } from "node:timers";

export const isDevToolsReachable = async (
  url = "ws://localhost:8097",
  timeoutMs = 2000,
): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    const socket = new WebSocket(url);
    let settled = false;

    const settle = (reachable: boolean) => {
      // Node 22 can emit another error synchronously when closing a failed
      // connection. Mark it settled before close() re-enters this handler.
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve(reachable);
    };

    const timeout = setTimeout(() => {
      settle(false);
    }, timeoutMs);
    // Don't let the timeout keep the process alive on its own
    timeout.unref();

    socket.addEventListener("open", () => {
      settle(true);
    });
    socket.addEventListener("error", () => {
      settle(false);
    });
  });
