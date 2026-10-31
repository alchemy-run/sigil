import { isDevToolsReachable } from "#/is-devtools-reachable.ts";

// Node 22.4+ ships a stable browser-compatible WebSocket client, so no `ws`
// dependency is needed. react-devtools-core resolves the constructor via the
// `window`/`ws` globals defined here.
Object.defineProperties(globalThis, {
  ws: { value: WebSocket },
  window: { value: globalThis },
  self: { value: globalThis },
});

// Filter out Ink's internal components from devtools for a cleaner view.
// Also, since `react-devtools-shared` package isn't published on npm, we can't
// use its types, that's why there are hard-coded values in `type` fields below.
// See https://github.com/facebook/react/blob/edf6eac8a181860fd8a2d076a43806f1237495a1/packages/react-devtools-shared/src/types.js#L24
Object.defineProperty(globalThis, "__REACT_DEVTOOLS_COMPONENT_FILTERS__", {
  value: [
    {
      // ComponentFilterElementType
      type: 1,
      // ElementTypeHostComponent
      value: 7,
      isEnabled: true,
    },
    {
      // ComponentFilterDisplayName
      type: 2,
      value: "InternalApp",
      isEnabled: true,
      isValid: true,
    },
    {
      // ComponentFilterDisplayName
      type: 2,
      value: "InternalAppContext",
      isEnabled: true,
      isValid: true,
    },
    {
      // ComponentFilterDisplayName
      type: 2,
      value: "InternalStdoutContext",
      isEnabled: true,
      isValid: true,
    },
    {
      // ComponentFilterDisplayName
      type: 2,
      value: "InternalStderrContext",
      isEnabled: true,
      isValid: true,
    },
    {
      // ComponentFilterDisplayName
      type: 2,
      value: "InternalStdinContext",
      isEnabled: true,
      isValid: true,
    },
    {
      // ComponentFilterDisplayName
      type: 2,
      value: "InternalFocusContext",
      isEnabled: true,
      isValid: true,
    },
  ],
});

// @ts-expect-error: react-devtools-core is not typed
const devtools = await import("react-devtools-core");

const isReachable = await isDevToolsReachable();

if (isReachable) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  devtools.initialize();
} else {
  console.warn(
    "SIGIL_DEV is set to true, but the React DevTools server is not running. Start it with:\n\n$ npx react-devtools\n",
  );
}

let websocket: WebSocket | undefined;
let connectedInstances = 0;

/**
Connect to React DevTools while at least one Sigil instance is mounted. Returns a function that releases the connection.

The open socket keeps the process alive, so it's closed once the last instance unmounts. Sigil owns the socket instead of using `connectToDevTools()`, which keeps no reference to hand back and reconnects on a timer that also keeps the process alive.
*/
export const connectToDevTools = (): (() => void) => {
  if (!isReachable) {
    return () => {};
  }

  connectedInstances++;

  if (connectedInstances === 1) {
    const socket = new WebSocket("ws://localhost:8097");
    const listeners = new Set<(message: unknown) => void>();
    let agent: { shutdown: () => void } | undefined;

    socket.addEventListener("message", (event) => {
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }

      for (const listener of listeners) {
        listener(message);
      }
    });

    socket.addEventListener("open", () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      devtools.connectWithCustomMessagingProtocol({
        onSubscribe(listener: (message: unknown) => void) {
          listeners.add(listener);
        },
        onUnsubscribe(listener: (message: unknown) => void) {
          listeners.delete(listener);
        },
        onMessage(event: string, payload: unknown) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ event, payload }));
          }
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      agent = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.reactDevtoolsAgent;
    });

    // Same teardown as `connectToDevTools()` on close: shutting down the agent unsubscribes from the hook and cleans up the renderer interfaces.
    socket.addEventListener("close", () => {
      agent?.shutdown();
      agent = undefined;
    });

    websocket = socket;
  }

  return () => {
    connectedInstances--;

    if (connectedInstances > 0) {
      return;
    }

    websocket?.close();
    websocket = undefined;
  };
};
