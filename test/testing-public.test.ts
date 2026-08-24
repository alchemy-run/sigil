import { expect, test } from "vite-plus/test";

import { createCell, Screen } from "#/screen/index.ts";
import { assertScreenText, FrameRecorder, screenText, VirtualOutput } from "#/testing/public.ts";

test("provides lean virtual streams and structured frame assertions", async () => {
  const output = new VirtualOutput({ columns: 20 });
  output.write("one");
  await new Promise<void>((resolve) => output.write("two", resolve));
  expect(output.output()).toBe("onetwo");

  const screen = new Screen(3, 1);
  screen.setCell(0, 0, createCell("x", 1));
  expect(screenText(screen)).toBe("x");
  expect(() => assertScreenText(screen, "x")).not.toThrow();
  expect(new FrameRecorder("none").record(screen).output).toBe("x");
});
