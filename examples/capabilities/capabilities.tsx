import React, { useState } from "react";

import {
  render,
  useApp,
  useInput,
  Box,
  Text,
  useCapabilities,
  useCapabilitiesChange,
  type Capabilities,
  type RgbColor,
} from "#/index.ts";

const hex = (color: RgbColor | undefined): string =>
  color
    ? `#${[color.r, color.g, color.b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
    : "unknown";

// Describes what changed between two snapshots — the interesting part of a
// subscription callback.
const describeChanges = (previous: Capabilities, next: Capabilities): string[] => {
  const changes: string[] = [];

  if (previous.size.columns !== next.size.columns || previous.size.rows !== next.size.rows) {
    changes.push(`resize → ${next.size.columns}×${next.size.rows}`);
  }

  const pixels = next.size.pixels?.textArea;
  if (pixels && previous.size.pixels?.textArea !== pixels) {
    changes.push(`pixels → ${pixels.width}×${pixels.height}px`);
  }

  if (previous.theme.appearance !== next.theme.appearance) {
    changes.push(`theme → ${next.theme.appearance ?? "unknown"}`);
  }

  if (hex(previous.theme.background) !== hex(next.theme.background)) {
    changes.push(`background → ${hex(next.theme.background)}`);
  }

  if (previous.focused !== next.focused) {
    changes.push(`focus → ${next.focused ? "gained" : "lost"}`);
  }

  if (previous.supports.kittyKeyboard === undefined && next.supports.kittyKeyboard !== undefined) {
    changes.push("query answered");
  }

  return changes;
};

const startedAt = Date.now();

// Subscription usage: `useCapabilitiesChange` is the React wrapper over
// `capabilities.subscribe()` and hands you both snapshots to diff.
function useCapabilityEvents(limit = 6): string[] {
  const [events, setEvents] = useState<string[]>([]);

  useCapabilitiesChange((next, previous) => {
    const changes = describeChanges(previous, next);
    if (changes.length === 0) {
      return;
    }

    const stamp = `+${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    setEvents((log) => [...log, ...changes.map((change) => `${stamp}  ${change}`)].slice(-limit));
  });

  return events;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box gap={1}>
      <Box width={22}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text>{children}</Text>
    </Box>
  );
}

function App() {
  const { exit } = useApp();
  const capabilities = useCapabilities();
  const events = useCapabilityEvents();

  useInput((input) => {
    if (input === "q") {
      exit();
    }
  });

  const { size, terminal, color, theme, supports } = capabilities;
  const queried = supports.kittyKeyboard !== undefined;

  return (
    <Box flexDirection="column">
      <Text bold>Terminal capabilities {queried ? "" : "(querying…)"}</Text>
      <Row label="size">
        {size.columns}×{size.rows}
        {size.pixels?.textArea
          ? ` (${size.pixels.textArea.width}×${size.pixels.textArea.height}px`
          : ""}
        {size.pixels?.cell
          ? `, cell ${size.pixels.cell.width}×${size.pixels.cell.height}px)`
          : size.pixels
            ? ")"
            : ""}
      </Row>
      <Row label="platform">{capabilities.platform}</Row>
      <Row label="ci / ssh">
        {String(capabilities.ci)} / {String(capabilities.ssh)}
      </Row>
      <Row label="interactive">{String(capabilities.interactive)}</Row>
      <Row label="focused">{String(capabilities.focused)}</Row>
      <Row label="terminal">
        {terminal.name ?? "unknown"}
        {terminal.version ? ` ${terminal.version}` : ""} (TERM={terminal.term ?? "unset"}
        {terminal.multiplexer ? `, in ${terminal.multiplexer}` : ""})
      </Row>
      <Row label="color depth">{color.depth}-bit</Row>
      <Row label="theme">
        {theme.appearance ?? "unknown"} (os: {theme.systemAppearance ?? "unknown"})
      </Row>
      <Row label="fg / bg / cursor">
        {hex(theme.foreground)} / {hex(theme.background)} / {hex(theme.cursor)}
      </Row>
      {theme.palette ? (
        <Row label="palette">
          {theme.palette.map((paletteColor, index) => (
            <Text key={index} backgroundColor={hex(paletteColor)}>
              {"  "}
            </Text>
          ))}
        </Row>
      ) : null}
      <Row label="hyperlinks">{String(supports.hyperlinks)}</Row>
      <Row label="unicode">{String(supports.unicode)}</Row>
      <Row label="kitty keyboard">{String(supports.kittyKeyboard)}</Row>
      <Row label="kitty graphics">{String(supports.kittyGraphics)}</Row>
      <Row label="sixel">{String(supports.sixel)}</Row>
      <Row label="synchronized output">{String(supports.synchronizedOutput)}</Row>
      <Row label="grapheme clustering">{String(supports.graphemeClustering)}</Row>
      <Row label="bracketed paste">{String(supports.bracketedPaste)}</Row>
      <Row label="color scheme updates">{String(supports.colorSchemeUpdates)}</Row>
      <Row label="in-band resize">{String(supports.inBandResize)}</Row>
      <Row label="focus events">{String(supports.focusEvents)}</Row>
      <Row label="mouse (sgr/pixel)">
        {String(supports.sgrMouse)} / {String(supports.sgrPixelMouse)}
      </Row>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Events</Text>
        {events.length === 0 ? (
          <Text dimColor>
            None yet — resize the window, switch your system theme, or focus another window.
          </Text>
        ) : (
          events.map((event, index) => <Text key={index}>{event}</Text>)
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press "q" to quit.</Text>
      </Box>
    </Box>
  );
}

render(<App />);
