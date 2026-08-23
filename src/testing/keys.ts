// Key names → escape sequences, Playwright-style: press("Enter"),
// press("Ctrl+C"), press("Shift+Tab"), or any single character.
import { CSI, ESC } from "#/ansi/escapes.ts";

const keySequences: Record<string, string> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Enter: "\r",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Tab: "\t",
  "Shift+Tab": `${CSI}Z`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Escape: ESC,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Backspace: "\u007F",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Delete: `${CSI}3~`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Space: " ",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ArrowUp: `${CSI}A`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ArrowDown: `${CSI}B`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ArrowRight: `${CSI}C`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ArrowLeft: `${CSI}D`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Home: `${CSI}H`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  End: `${CSI}F`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PageUp: `${CSI}5~`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PageDown: `${CSI}6~`,
};

export const keyToSequence = (key: string): string => {
  const sequence = keySequences[key];
  if (sequence !== undefined) {
    return sequence;
  }

  const ctrl = /^Ctrl\+([a-z])$/i.exec(key);
  if (ctrl) {
    return String.fromCharCode(ctrl[1]!.toLowerCase().charCodeAt(0) - 96);
  }

  if (Array.from(key).length === 1) {
    return key;
  }

  throw new Error(
    `Unknown key "${key}". Use a named key (${Object.keys(keySequences).join(", ")}), ` +
      `"Ctrl+<letter>", or a single character.`,
  );
};
