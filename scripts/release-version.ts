const spec = process.argv[2]?.trim() || "alpha";
const alpha = spec.match(/^alpha(?:\.(0|[1-9]\d*))?$/);

if (!alpha) {
  // Let pnpm validate explicit versions and standard version increments.
  console.log(spec);
} else if (alpha[1] !== undefined) {
  console.log(`0.1.0-alpha.${alpha[1]}`);
} else {
  const response = await fetch("https://registry.npmjs.org/@alchemy.run%2Fsigil");
  if (!response.ok && response.status !== 404) {
    throw new Error(`Unable to read published Sigil versions: HTTP ${response.status}`);
  }
  const metadata =
    response.status === 404
      ? {}
      : ((await response.json()) as {
          versions?: Record<string, unknown>;
        });
  const candidates = Object.keys(metadata.versions ?? {}).flatMap((version) => {
    const match = version.match(/^0\.1\.0-alpha\.(\d+)$/);
    return match ? [Number(match[1])] : [];
  });
  console.log(`0.1.0-alpha.${Math.max(0, ...candidates) + 1}`);
}

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
