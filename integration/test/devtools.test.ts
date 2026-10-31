import { expect, onTestFinished, test } from "vite-plus/test";

import { createWebSocketServer } from "../../test/helpers/websocket-server.ts";
import term from "./helpers/term.ts";

test("exit on unmount() while connected to React DevTools", async (context) => {
  // The DevTools port is not configurable, so the fake DevTools server has to listen on the default one.
  let server: Awaited<ReturnType<typeof createWebSocketServer>>;
  try {
    server = await createWebSocketServer(8097);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      context.skip("Port 8097 is in use");
    }

    throw error;
  }

  onTestFinished(async () => {
    await server.close();
  });

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const ps = term("devtools-exit-on-unmount", [], { env: { SIGIL_DEV: "true" } });
  await ps.waitForExit();

  expect(ps.output).toContain("exited");
  expect(server.receivedChunks, "DevTools never received a message").toBeGreaterThan(0);
});
