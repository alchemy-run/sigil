import { setTimeout } from "node:timers";

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

const isDevToolsReachable = () =>
  new Promise<boolean>((resolve) => {
    const socket = new WebSocket("ws://localhost:8097");

    const settle = (reachable: boolean) => {
      clearTimeout(timeout);
      socket.close();
      resolve(reachable);
    };

    const timeout = setTimeout(() => {
      settle(false);
    }, 2000);
    // Don't let the timeout keep the process alive on its own
    timeout.unref();

    socket.addEventListener("open", () => {
      settle(true);
    });
    socket.addEventListener("error", () => {
      settle(false);
    });
  });

if (await isDevToolsReachable()) {
  // @ts-expect-error: react-devtools-core is not typed
  const devtools = await import("react-devtools-core");
  devtools.initialize();
  devtools.connectToDevTools();
} else {
  console.warn(
    "SIGIL_DEV is set to true, but the React DevTools server is not running. Start it with:\n\n$ npx react-devtools\n",
  );
}
