// Every modern CI provider sets CI=1 (or CI=true), so any non-empty value
export const isInCi = Boolean(process.env.CI);

export const isSigilDev = process.env.SIGIL_DEV === "true";

export const isScreenReader = process.env.SIGIL_SCREEN_READER === "true";

export const isWindows = process.platform === "win32";

export const isMacos = process.platform === "darwin";

export const isTty = (stream: NodeJS.ReadableStream) => "isTTY" in stream && stream.isTTY === true;
