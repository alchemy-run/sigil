import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { expect, test } from "vite-plus/test";

// Sigil has no TypeScript compiler API dependency, so JSDoc and type members are
// read with light regexes instead of Ink's `typescript`-based traversal.
const rootDir = path.join(import.meta.dirname, "..");
const readme = fs.readFileSync(path.join(rootDir, "README.md"), "utf8");

const sourceFiles = fs
  .readdirSync(path.join(rootDir, "src"), { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx?$/.test(file))
  .map((file) => ({
    fileName: path.join("src", file),
    text: fs.readFileSync(path.join(rootDir, "src", file), "utf8"),
  }));

const defaultTag = /^\s*(?:\*\s*)?@default\s+(?<value>.+?)\s*$/gm;

const isExpression = (text: string): boolean => {
  try {
    // Compiles without running; a value parses as a single expression, a sentence does not.
    return new vm.Script(`(${text});`) instanceof vm.Script;
  } catch {
    return false;
  }
};

test("`@default` tags contain a value, not a sentence", () => {
  const invalid: string[] = [];

  for (const { fileName, text } of sourceFiles) {
    for (const match of text.matchAll(defaultTag)) {
      const value = match.groups!["value"];
      if (!isExpression(value)) {
        const line = text.slice(0, match.index).split("\n").length;
        invalid.push(`${fileName}:${line}: ${value}`);
      }
    }
  }

  expect(invalid).toEqual([]);
});

const getReadmeOptions = (heading: string): Map<string, string | undefined> => {
  const start = readme.indexOf(`\n${heading}\n`);
  const rest = readme.slice(start + heading.length + 2);
  const end = rest.search(/^#{1,4} /m);
  const section = end === -1 ? rest : rest.slice(0, end);
  const options = new Map<string, string | undefined>();

  for (const { groups } of section.matchAll(
    /^#{6} (?<name>\w+)\n(?<body>[\s\S]*?)(?=^#{5,6} |(?![\s\S]))/gm,
  )) {
    options.set(
      groups!["name"],
      /^Default: `(?<value>.+?)`/m.exec(groups!["body"])?.groups?.["value"],
    );
  }

  return options;
};

// Top-level members of `export type <name> = { ... };`, with the `@default` from each member's JSDoc.
const getTypeMembers = (typeName: string): Map<string, string | undefined> | undefined => {
  for (const { text } of sourceFiles) {
    const start = text.search(new RegExp(`^export type ${typeName} = \\{$`, "m"));
    if (start === -1) {
      continue;
    }

    const body = text.slice(start, text.indexOf("\n};", start));
    const members = new Map<string, string | undefined>();
    for (const { groups } of body.matchAll(
      /(?:\/\*\*(?<doc>(?:(?!\*\/)[\s\S])*)\*\/\s*)?^ {2}(?:readonly )?(?<name>\w+)\??:/gm,
    )) {
      const doc = groups!["doc"] ?? "";
      members.set(groups!["name"], [...doc.matchAll(defaultTag)].at(-1)?.groups?.["value"]);
    }

    return members;
  }

  return undefined;
};

for (const [typeName, heading] of [
  ["RenderOptions", "#### render(tree, options?)"],
  ["RenderToStringOptions", "#### renderToString(tree, options?)"],
] as const) {
  test(`\`${typeName}\` matches the readme`, () => {
    const readmeOptions = getReadmeOptions(heading);
    const members = getTypeMembers(typeName);
    const problems: string[] = [];

    expect(readmeOptions.size, `Missing readme section: ${heading}`).toBeGreaterThan(0);
    expect(members, `Missing type: ${typeName}`).toBeDefined();

    for (const [name, typeDefault] of members!) {
      if (!readmeOptions.has(name)) {
        problems.push(`\`${name}\` is not documented in the readme`);
        continue;
      }

      const readmeDefault = readmeOptions.get(name);
      if (
        typeDefault !== undefined &&
        readmeDefault !== undefined &&
        typeDefault !== readmeDefault
      ) {
        problems.push(
          `\`${name}\` defaults to \`${typeDefault}\` in the TS docs but \`${readmeDefault}\` in the readme`,
        );
      }
    }

    expect(problems).toEqual([]);
  });
}
