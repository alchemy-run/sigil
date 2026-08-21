import isInCi from "./is-in-ci.ts";

export const bsu = "\u001B[?2026h";
export const esu = "\u001B[?2026l";

export function shouldSynchronize(stream: NodeJS.WritableStream, interactive?: boolean): boolean {
  return (
    "isTTY" in stream &&
    (stream as NodeJS.WritableStream & { isTTY: boolean }).isTTY &&
    (interactive ?? !isInCi)
  );
}
