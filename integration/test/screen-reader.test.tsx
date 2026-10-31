import { expect, test } from "vite-plus/test";

import term from "./helpers/term.ts";

test("SIGIL_SCREEN_READER=true enables screen-reader output unless the option disables it", async () => {
  const output = async (value: string, args: string[] = []) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const ps = term("screen-reader-env", args, { env: { SIGIL_SCREEN_READER: value } });
    await ps.waitForExit();
    return ps.output.includes("Hello World") ? "screen reader" : "visual";
  };

  expect(await output("true")).toBe("screen reader");
  expect(await output("true", ["false"])).toBe("visual");
  expect(await output("false")).toBe("visual");
  expect(await output("false", ["true"])).toBe("screen reader");
});
