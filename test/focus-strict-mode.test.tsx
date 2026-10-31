import { StrictMode } from "react";
import { expect, onTestFinished, test } from "vite-plus/test";

import { Box, Text, render, useFocus, useFocusManager } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

for (const isConcurrent of [false, true]) {
  for (const isStrict of [false, true]) {
    test(`focus updates preserve call order (concurrent: ${isConcurrent}, StrictMode: ${isStrict})`, async () => {
      const stdin = createStdin();
      const stdout = createStdout();
      let manager!: ReturnType<typeof useFocusManager>;

      function Field({ id }: { readonly id: string }) {
        const { isFocused } = useFocus({ id });
        return <Text>{isFocused ? `[${id}]` : id}</Text>;
      }

      function Form() {
        manager = useFocusManager();
        return (
          <Box>
            <Field id="a" />
            <Field id="b" />
            <Field id="c" />
          </Box>
        );
      }

      let instance!: ReturnType<typeof render>;
      await act(async () => {
        instance = render(
          isStrict ? (
            <StrictMode>
              <Form />
            </StrictMode>
          ) : (
            <Form />
          ),
          {
            stdout,
            stdin,
            debug: true,
            concurrent: isConcurrent,
            patchConsole: false,
          },
        );
      });
      onTestFinished(async () => {
        await act(async () => {
          instance.unmount();
        });
      });

      await act(async () => {
        manager.focusNext();
        manager.focusNext();
      });
      expect(manager.activeId, "Two batched focusNext calls must advance twice").toBe("b");

      await act(async () => {
        manager.focusNext();
        manager.focus("a");
      });
      expect(manager.activeId, "An explicit focus after navigation wins").toBe("a");

      await act(async () => {
        manager.focus("c");
        manager.focusPrevious();
      });
      expect(manager.activeId, "Navigation starts from the latest explicit focus").toBe("b");

      /* eslint-disable no-await-in-loop, @typescript-eslint/no-loop-func -- Each action must commit before checking the latest manager value. */
      for (const expected of ["c", "a", "b", "c"]) {
        await act(async () => {
          emitReadable(stdin, "\t");
        });
        expect(manager.activeId).toBe(expected);
      }

      for (const method of ["focusNext", "focusPrevious", "focus"] as const) {
        await act(async () => {
          manager.enableFocus();
          manager.focus("b");
        });
        await act(async () => {
          if (method === "focus") {
            manager.focus("a");
          } else {
            manager[method]();
          }

          manager.disableFocus();
        });
        expect(manager.activeId, `disableFocus must take effect after ${method}`).toBe(undefined);
        expect(stdout.get()).toBe("abc");

        await act(async () => {
          emitReadable(stdin, "\t");
        });
        expect(manager.activeId, "Tab must remain disabled").toBe(undefined);
      }

      /* eslint-enable no-await-in-loop, @typescript-eslint/no-loop-func */

      await act(async () => {
        manager.enableFocus();
        emitReadable(stdin, "\t");
      });
      expect(manager.activeId, "Re-enabling focus restores keyboard navigation").toBe("a");
      expect(stdout.get()).toBe("[a]bc");
    });
  }
}
