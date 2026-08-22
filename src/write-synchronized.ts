import isInCi from "./is-in-ci.ts";

export function shouldSynchronize(stream: NodeJS.WritableStream, interactive?: boolean): boolean {
  return (
    "isTTY" in stream &&
    (stream as NodeJS.WritableStream & { isTTY: boolean }).isTTY &&
    (interactive ?? !isInCi)
  );
}
