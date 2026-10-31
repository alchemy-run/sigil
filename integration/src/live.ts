// Mirrors a harness-launched terminal session to a live-view hub (the
// explorer's /live page) over WebSocket, so e2e runs can be watched in the
// browser while they execute — Playwright-UI style.
//
// Activated by the SIGIL_LIVE_URL environment variable (the explorer sets it
// for the Vitest UI it spawns). Mirroring is fire-and-forget: a missing or
// dead hub never affects the test.

type LiveMessage =
  | { type: "start"; id: string; title: string; columns: number; rows: number }
  | { type: "title"; id: string; title: string }
  | { type: "data"; id: string; data: string }
  | { type: "end"; id: string; code: number | undefined };

export type LiveClient = {
  send: (message: LiveMessage) => void;
  close: () => void;
};

/**
Connects to the live hub named by `SIGIL_LIVE_URL`, or returns `undefined`
when none is configured. Messages sent before the socket opens are queued.
*/
export const connectLiveClient = (): LiveClient | undefined => {
  const base = process.env["SIGIL_LIVE_URL"];
  if (!base) {
    return undefined;
  }

  let socket: WebSocket | undefined;
  let failed = false;
  const queue: string[] = [];

  try {
    const url = new URL("/live/ingest", base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(url);
  } catch {
    return undefined;
  }

  socket.addEventListener("open", () => {
    for (const message of queue) {
      socket?.send(message);
    }

    queue.length = 0;
  });
  socket.addEventListener("error", () => {
    failed = true;
    queue.length = 0;
  });

  return {
    send: (message) => {
      if (failed) {
        return;
      }

      const encoded = JSON.stringify(message);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(encoded);
      } else if (socket?.readyState === WebSocket.CONNECTING) {
        queue.push(encoded);
      }
    },
    close: () => {
      try {
        socket?.close();
      } catch {}
    },
  };
};

/**
The current test name when running inside Vitest, for labeling the session.
*/
export const currentTestName = async (): Promise<string | undefined> => {
  try {
    const { expect } = await import("vitest");
    return expect.getState().currentTestName ?? undefined;
  } catch {
    return undefined;
  }
};
