import { kittyQuery } from "#/ansi/escapes.ts";

// Kitty keyboard protocol flags.
// @see https://sw.kovidgoyal.net/kitty/keyboard-protocol/
export const kittyFlags = {
  disambiguateEscapeCodes: 1,
  reportEventTypes: 2,
  reportAlternateKeys: 4,
  reportAllKeysAsEscapeCodes: 8,
  reportAssociatedText: 16,
} as const;

// Valid flag names for the kitty keyboard protocol.
export type KittyFlagName = keyof typeof kittyFlags;

// Converts an array of flag names to the corresponding bitmask value.
export function resolveFlags(flags: KittyFlagName[]): number {
  let result = 0;
  for (const flag of flags) {
    // eslint-disable-next-line no-bitwise
    result |= kittyFlags[flag];
  }

  return result;
}

// Kitty keyboard modifier bits.
// These are used in the modifier parameter of CSI u sequences.
// Note: The actual modifier value is (modifiers - 1) as per the protocol.
export const kittyModifiers = {
  shift: 1,
  alt: 2,
  ctrl: 4,
  super: 8,
  hyper: 16,
  meta: 32,
  capsLock: 64,
  numLock: 128,
} as const;

// Options for configuring kitty keyboard protocol.
export type KittyKeyboardOptions = {
  // Mode for kitty keyboard protocol support.
  // - 'auto': Attempt to detect terminal support (default)
  // - 'enabled': Force enable the protocol
  // - 'disabled': Never enable the protocol
  mode?: "auto" | "enabled" | "disabled";

  // Protocol flags to request from the terminal.
  // Pass an array of flag name strings.
  //
  // Available flags:
  // - 'disambiguateEscapeCodes' - Disambiguate escape codes (default)
  // - 'reportEventTypes' - Report key press, repeat, and release events
  // - 'reportAlternateKeys' - Report alternate key encodings
  // - 'reportAllKeysAsEscapeCodes' - Report all keys as escape codes
  // - 'reportAssociatedText' - Report associated text with key events
  flags?: KittyFlagName[];
};

const textEncoder = new TextEncoder();

const kittyQueryEscapeByte = 0x1b;
const kittyQueryOpenBracketByte = 0x5b;
const kittyQueryQuestionMarkByte = 0x3f;
const kittyQueryLetterByte = 0x75;
const zeroByte = 0x30;
const nineByte = 0x39;

type KittyQueryResponseMatch = { state: "complete"; endIndex: number } | { state: "partial" };

const isDigitByte = (byte: number): boolean => byte >= zeroByte && byte <= nineByte;

const matchKittyQueryResponse = (
  buffer: number[],
  startIndex: number,
): KittyQueryResponseMatch | undefined => {
  if (
    buffer[startIndex] !== kittyQueryEscapeByte ||
    buffer[startIndex + 1] !== kittyQueryOpenBracketByte ||
    buffer[startIndex + 2] !== kittyQueryQuestionMarkByte
  ) {
    return;
  }

  let index = startIndex + 3;
  const digitsStartIndex = index;
  while (index < buffer.length && isDigitByte(buffer[index]!)) {
    index++;
  }

  if (index === digitsStartIndex) {
    return;
  }

  if (index === buffer.length) {
    return { state: "partial" };
  }

  if (buffer[index] === kittyQueryLetterByte) {
    return { state: "complete", endIndex: index };
  }

  return;
};

const hasCompleteKittyQueryResponse = (buffer: number[]): boolean => {
  for (let index = 0; index < buffer.length; index++) {
    const match = matchKittyQueryResponse(buffer, index);
    if (match?.state === "complete") {
      return true;
    }
  }

  return false;
};

const stripKittyQueryResponsesAndTrailingPartial = (buffer: number[]): number[] => {
  const keptBytes: number[] = [];
  let index = 0;
  while (index < buffer.length) {
    const match = matchKittyQueryResponse(buffer, index);
    if (match?.state === "complete") {
      index = match.endIndex + 1;
      continue;
    }

    if (match?.state === "partial") {
      break;
    }

    keptBytes.push(buffer[index]!);
    index++;
  }

  return keptBytes;
};

// Query the terminal for kitty keyboard protocol support. The CSI ? u query is
// safe to send to any terminal — unsupporting terminals simply won't respond,
// and the 200ms timeout handles that. Stdin bytes that aren't part of the
// protocol response are re-emitted so they aren't lost from the caller's input
// pipeline. Returns a cancel function; cancelling (or the timeout firing)
// means `onSupported` never runs.
export const detectKittySupport = (
  stdin: NodeJS.ReadableStream,
  stdout: { write: (data: string) => unknown },
  onSupported: () => void,
): (() => void) => {
  let responseBuffer: number[] = [];

  const cleanup = (): void => {
    clearTimeout(timer);
    stdin.removeListener("data", onData);

    // Re-emit any buffered data that wasn't the protocol response.
    // Clear responseBuffer afterwards to make cleanup idempotent.
    const remaining = stripKittyQueryResponsesAndTrailingPartial(responseBuffer);
    responseBuffer = [];
    if (remaining.length > 0) {
      stdin.unshift(Uint8Array.from(remaining));
    }
  };

  const onData = (data: Uint8Array | string): void => {
    const chunk = typeof data === "string" ? textEncoder.encode(data) : data;
    for (const byte of chunk) {
      responseBuffer.push(byte);
    }

    if (hasCompleteKittyQueryResponse(responseBuffer)) {
      cleanup();
      onSupported();
    }
  };

  // Attach listener before writing the query so that synchronous
  // or immediate responses are not missed.
  stdin.on("data", onData);
  const timer = setTimeout(cleanup, 200);

  stdout.write(kittyQuery);

  return cleanup;
};
