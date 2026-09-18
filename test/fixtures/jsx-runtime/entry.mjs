import assert from "node:assert/strict";

// Match Alchemy's launcher: Bun has already selected its JSX transform.
process.env.NODE_ENV = "production";

const { jsxDEV, Fragment } = await import("@alchemy.run/sigil/jsx-dev-runtime");
const { jsx, jsxs } = await import("@alchemy.run/sigil/jsx-runtime");
const { isValidElement, useState } = await import("@alchemy.run/sigil/react");
const { Text, renderToString } = await import("@alchemy.run/sigil");

assert.equal(typeof jsxDEV, "function");
assert.equal(jsxDEV, jsx);
assert.equal(process.env.CI, "true");
assert.ok(!process.stdout.isTTY);

function Status() {
  const [label] = useState("Planning stack");
  return jsx(Text, { children: label });
}

// Exercise the full development call signature, including static children,
// source metadata and self, against the production renderer.
const child = jsxDEV(Status, {}, "status", false, { fileName: "child.tsx", lineNumber: 1 }, null);
assert.equal(child.key, "status");
assert.ok(isValidElement(child));
const tree = jsxDEV(Fragment, { children: [child] }, undefined, true, undefined, undefined);
assert.equal(renderToString(tree), "Planning stack");
assert.equal(renderToString(jsxs(Fragment, { children: [child] })), "Planning stack");

const output = process.argv.includes("--tsx")
  ? renderToString((await import("./child.tsx")).make())
  : renderToString(tree);
assert.equal(output, "Planning stack");
console.log(output);
