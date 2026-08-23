import { useEffect, useEffectEvent, useSyncExternalStore } from "react";

import { type Capabilities } from "#/capabilities/detect.ts";
import { getCapabilities } from "#/capabilities/store.ts";
import { useStdinContext } from "#/hooks/use-stdin.ts";
import { useStdout } from "#/hooks/use-stdout.ts";

/**
Returns everything knowable about the terminal: size, identity, platform,
color depth, theme, and feature support.

A thin wrapper over the framework-free capabilities store (`getCapabilities`):
environment-derived facts are available immediately; facts only the terminal
itself can answer fill in after a lazy one-time query, and re-mounting
consumers refreshes the dynamic facts (theme colors, pixel geometry).
Re-renders on terminal resize and whenever query answers arrive.
*/
export const useCapabilities = (): Capabilities => {
  const { stdout } = useStdout();
  const { stdin } = useStdinContext();
  const store = getCapabilities(stdin, stdout);

  const capabilities = useSyncExternalStore(store.subscribe, () => store.current);

  useEffect(() => {
    void store.query();
  }, [store]);

  return capabilities;
};

/**
Calls `onChange` whenever the terminal changes: resizes (including in-band
pixel geometry), color scheme switches, window focus, and query answers
arriving. The React wrapper over `capabilities.subscribe()` for side effects —
for rendering, use `useCapabilities` instead.

The callback always sees the latest render's closure and changing it does not
resubscribe. Both the new and previous snapshot are passed, so handlers can
react to the specific change:

```tsx
useCapabilitiesChange((next, previous) => {
  if (next.theme.appearance !== previous.theme.appearance) {
    // re-theme
  }
});
```
*/
export const useCapabilitiesChange = (
  onChange: (capabilities: Capabilities, previous: Capabilities) => void,
): void => {
  const { stdout } = useStdout();
  const { stdin } = useStdinContext();
  const store = getCapabilities(stdin, stdout);

  const handleChange = useEffectEvent(onChange);

  useEffect(() => {
    let previous = store.current;
    const unsubscribe = store.subscribe((next) => {
      const before = previous;
      previous = next;
      handleChange(next, before);
    });

    // Make sure the terminal has been asked — push report modes only turn
    // on once the query has revealed support for them.
    void store.query();

    return unsubscribe;
  }, [store]);
};
