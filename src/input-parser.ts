import { ESC, pasteStart, pasteEnd } from "#/ansi/escapes.ts";

const escape = ESC;

export type InputEvent = string | { readonly paste: string };

type ParsedInput = {
  readonly events: InputEvent[];
  readonly pending: string;
};

type ParsedSequence =
  | {
      readonly sequence: string;
      readonly nextIndex: number;
    }
  | "pending"
  | undefined;

const isCsiParameterByte = (byte: number): boolean => {
  return byte >= 0x30 && byte <= 0x3f;
};

const isCsiIntermediateByte = (byte: number): boolean => {
  return byte >= 0x20 && byte <= 0x2f;
};

const isCsiFinalByte = (byte: number): boolean => {
  return byte >= 0x40 && byte <= 0x7e;
};

const parseCsiSequence = (
  input: string,
  startIndex: number,
  prefixLength: number,
): ParsedSequence => {
  const csiPayloadStart = startIndex + prefixLength + 1;
  let index = csiPayloadStart;
  for (; index < input.length; index++) {
    const byte = input.codePointAt(index);
    if (byte === undefined) {
      return "pending";
    }

    // A new Escape or Ctrl+C cancels a truncated control sequence. Keep the
    // cancelling byte for the next event, never insert the abandoned prefix.
    if (byte === 0x1b || byte === 0x03) {
      return { sequence: "", nextIndex: index };
    }

    // Preserve legacy terminal function-key sequences like ESC[[A and ESC[[5~.
    if (byte === 0x5b && index === csiPayloadStart) {
      continue;
    }

    // Shifted editing keys in rxvt end in $, which is normally a CSI intermediate byte.
    const isRxvtShiftKey =
      byte === 0x24 && index === csiPayloadStart + 1 && "235678".includes(input[csiPayloadStart]!);

    if (isRxvtShiftKey || isCsiFinalByte(byte)) {
      // A bare ESC[M is a legacy X10/normal mouse report, followed by three raw
      // bytes: button, column and row. Coordinates past 95 are bytes >= 0x80,
      // which the UTF-8 decoder can merge, so this is best effort (SGR 1006
      // reports don't have the problem). Coordinates are never below 0x20
      // except NUL (xterm's past-223 position), so any other control byte ends
      // the sequence at M and a Ctrl+C or the next report's ESC parses normally.
      let length = 1;
      if (byte === 0x4d && index === csiPayloadStart) {
        const coordinates = input.slice(index + 1, index + 4);
        // oxlint-disable-next-line typescript/no-misused-spread
        if ([...coordinates].every((character) => character >= " " || character === "\0")) {
          if (coordinates.length < 3) return "pending";
          length = 4;
        }
      }

      return {
        sequence: input.slice(startIndex, index + length),
        nextIndex: index + length,
      };
    }

    if (isCsiParameterByte(byte) || isCsiIntermediateByte(byte)) {
      continue;
    }

    return;
  }

  return "pending";
};

const parseSs3Sequence = (
  input: string,
  startIndex: number,
  prefixLength: number,
): ParsedSequence => {
  for (let index = startIndex + prefixLength + 1; index < input.length; index++) {
    const byte = input.codePointAt(index)!;
    if (isCsiFinalByte(byte)) {
      return {
        sequence: input.slice(startIndex, index + 1),
        nextIndex: index + 1,
      };
    }

    // Modified SS3 keys can include numeric parameters separated by semicolons.
    if (byte !== 0x3b && (byte < 0x30 || byte > 0x39)) {
      return;
    }
  }

  return "pending";
};

const parseControlSequence = (
  input: string,
  startIndex: number,
  prefixLength: number,
): ParsedSequence => {
  const sequenceType = input[startIndex + prefixLength];
  if (sequenceType === undefined) {
    return "pending";
  }

  if (sequenceType === "[") {
    return parseCsiSequence(input, startIndex, prefixLength);
  }

  // OSC, DCS and APC replies are single events, even across stdin chunks.
  if (sequenceType === "]" || sequenceType === "P" || sequenceType === "_") {
    for (let index = startIndex + prefixLength + 1; index < input.length; index++) {
      if (
        input[index] === "\u0003" ||
        (input[index] === escape && index + 1 < input.length && input[index + 1] !== "\\")
      ) {
        return { sequence: "", nextIndex: index };
      }
      const bel = sequenceType === "]" && input[index] === "\u0007";
      const st = input[index] === escape && input[index + 1] === "\\";
      if (bel || st) {
        const nextIndex = index + (st ? 2 : 1);
        return { sequence: input.slice(startIndex, nextIndex), nextIndex };
      }
    }
    return "pending";
  }

  if (sequenceType === "O") {
    return parseSs3Sequence(input, startIndex, prefixLength);
  }

  return;
};

/**
Whether `input` is exactly one complete control sequence as the parser defines
it, including legacy `ESC[[A`, rxvt `ESC[2$` and parameterized SS3 forms.
Partial sequences (timeout-flushed) and plain escaped code points are not.
*/
export const isCompleteControlSequence = (input: string): boolean => {
  if (!input.startsWith(escape)) {
    return false;
  }

  const prefixLength = input[1] === escape ? 2 : 1;

  // The parser emits a bare legacy mouse prefix only when the byte after it
  // can't be a coordinate, so there is nothing left to wait for.
  if (input.slice(prefixLength) === "[M") {
    return true;
  }

  const parsed = parseControlSequence(input, 0, prefixLength);
  return (
    typeof parsed === "object" && parsed.sequence.length > 0 && parsed.nextIndex === input.length
  );
};

const parseEscapedCodePoint = (
  input: string,
  escapeIndex: number,
): {
  readonly sequence: string;
  readonly nextIndex: number;
} => {
  const nextCodePoint = input.codePointAt(escapeIndex + 1);
  const nextCodePointLength = nextCodePoint !== undefined && nextCodePoint > 0xff_ff ? 2 : 1;
  const nextIndex = escapeIndex + 1 + nextCodePointLength;

  return {
    sequence: input.slice(escapeIndex, nextIndex),
    nextIndex,
  };
};

type ParsedEscapeSequence =
  | {
      readonly sequence: string;
      readonly nextIndex: number;
    }
  | "pending";

const parseEscapeSequence = (input: string, escapeIndex: number): ParsedEscapeSequence => {
  if (escapeIndex === input.length - 1) {
    return "pending";
  }

  const next = input[escapeIndex + 1]!;
  if (next === escape) {
    if (escapeIndex + 2 >= input.length) {
      return "pending";
    }

    const doubleEscapeSequence = parseControlSequence(input, escapeIndex, 2);
    if (doubleEscapeSequence === "pending") {
      return "pending";
    }

    if (doubleEscapeSequence) {
      return doubleEscapeSequence;
    }

    return {
      sequence: input.slice(escapeIndex, escapeIndex + 2),
      nextIndex: escapeIndex + 2,
    };
  }

  const controlSequence = parseControlSequence(input, escapeIndex, 1);
  if (controlSequence === "pending") {
    return "pending";
  }

  if (controlSequence) {
    return controlSequence;
  }

  return parseEscapedCodePoint(input, escapeIndex);
};

/**
Split a chunk of non-escape text so that backspace bytes (`0x7F` and `0x08`) and Ctrl+C (`0x03`) become individual events. Ctrl+C must be recognized even when buffered with ordinary text. When a user holds the backspace key, the terminal sends repeated bytes in a single stdin chunk. Without splitting, `parseKeypress` receives the multi-byte string and fails to recognize it as a key event, corrupting the input state.

Other control characters like `\r` and `\t` are NOT split because they can legitimately appear inside pasted text.
*/
const splitControlBytes = (text: string, events: InputEvent[]): void => {
  let textSegmentStart = 0;

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (character === "\u007F" || character === "\u0008" || character === "\u0003") {
      if (index > textSegmentStart) {
        events.push(text.slice(textSegmentStart, index));
      }

      events.push(character);
      textSegmentStart = index + 1;
    }
  }

  if (textSegmentStart < text.length) {
    events.push(text.slice(textSegmentStart));
  }
};

const parseKeypresses = (input: string): ParsedInput => {
  const events: InputEvent[] = [];
  let index = 0;
  const pendingFrom = (pendingStartIndex: number): ParsedInput => ({
    events,
    pending: input.slice(pendingStartIndex),
  });

  while (index < input.length) {
    const escapeIndex = input.indexOf(escape, index);
    if (escapeIndex === -1) {
      splitControlBytes(input.slice(index), events);
      return {
        events,
        pending: "",
      };
    }

    if (escapeIndex > index) {
      splitControlBytes(input.slice(index, escapeIndex), events);
    }

    const parsedEscapeSequence = parseEscapeSequence(input, escapeIndex);
    if (parsedEscapeSequence === "pending") {
      return pendingFrom(escapeIndex);
    }

    if (parsedEscapeSequence.sequence === pasteStart) {
      const afterStart = parsedEscapeSequence.nextIndex;
      const endIndex = input.indexOf(pasteEnd, afterStart);
      if (endIndex === -1) {
        return pendingFrom(escapeIndex);
      }

      events.push({ paste: input.slice(afterStart, endIndex) });
      index = endIndex + pasteEnd.length;
      continue;
    }

    if (parsedEscapeSequence.sequence.length > 0) events.push(parsedEscapeSequence.sequence);
    index = parsedEscapeSequence.nextIndex;
  }

  return {
    events,
    pending: "",
  };
};

export type InputParser = {
  push: (chunk: string) => InputEvent[];
  hasPendingEscape: () => boolean;
  hasPendingCsiIntroducer: () => boolean;
  flushPendingEscape: () => string | undefined;
  reset: () => void;
};

export const createInputParser = (): InputParser => {
  let pending = "";
  // Only ambiguous Escape/Alt prefixes may time out. Once a control
  // sequence starts, keep it intact until its terminator arrives.
  const hasPendingEscape = () => pending.startsWith(escape) && !/^\u001B{1,2}[[\]P_]/.test(pending);
  // A bare `ESC[` is also what Alt+[ sends. It may time out too, just later
  // than a lone Escape, so a terminal reply split right after it still joins.
  const hasPendingCsiIntroducer = () => /^\u001B{1,2}\[$/.test(pending);

  return {
    push(chunk) {
      const parsedInput = parseKeypresses(pending + chunk);
      pending = parsedInput.pending;
      return parsedInput.events;
    },
    hasPendingEscape,
    hasPendingCsiIntroducer,
    flushPendingEscape() {
      if (!hasPendingEscape() && !hasPendingCsiIntroducer()) {
        return;
      }

      const pendingEscape = pending;
      pending = "";
      return pendingEscape;
    },
    reset() {
      pending = "";
    },
  };
};
