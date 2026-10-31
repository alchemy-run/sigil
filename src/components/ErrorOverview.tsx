/** @jsxImportSource react */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

import { codeExcerpt, type CodeExcerpt } from "#/code-excerpt.ts";
import { Box } from "#/components/Box.tsx";
import { Text } from "#/components/Text.tsx";
import { parseStackLine } from "#/parse-stack-line.ts";

// Error's source file is reported as file:///home/user/file.js
// This function converts file URLs to paths relative to the current directory
const cleanupPath = (path: string | undefined): string | undefined => {
  if (!path?.startsWith("file://")) {
    return path;
  }

  try {
    return relative(cwd(), fileURLToPath(path));
  } catch {
    // A stack from another machine or platform can hold a file URL that is not valid here (a host, a malformed escape). Show it as-is rather than let the error screen itself throw.
    return path;
  }
};

type Props = {
  readonly error: Error;
};

export function ErrorOverview({ error }: Props) {
  // Skip every line of the message, not just the first, so multiline messages aren't read as frames.
  const stack = error.stack?.split("\n").slice(error.message.split("\n").length);
  const origin = stack ? parseStackLine(stack[0]!) : undefined;
  const filePath = cleanupPath(origin?.file);
  let excerpt: CodeExcerpt[] | undefined;
  let lineWidth = 0;
  const stackLineCounts = new Map<string, number>();

  if (filePath && origin?.line) {
    try {
      const sourceCode = readFileSync(filePath, "utf8");
      excerpt = codeExcerpt(sourceCode, origin.line);
    } catch {
      // Source excerpts are best-effort and must not hide the original error.
    }

    if (excerpt) {
      for (const { line } of excerpt) {
        lineWidth = Math.max(lineWidth, String(line).length);
      }
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text backgroundColor="red" color="white">
          {" "}
          ERROR{" "}
        </Text>

        <Text> {error.message}</Text>
      </Box>

      {origin && filePath ? (
        <Box marginTop={1}>
          <Text dimColor>
            {filePath}:{origin.line}:{origin.column}
          </Text>
        </Box>
      ) : null}

      {origin && excerpt ? (
        <Box marginTop={1} flexDirection="column">
          {excerpt.map(({ line, value }) => (
            <Box key={line}>
              <Box width={lineWidth + 1}>
                <Text
                  dimColor={line !== origin.line}
                  backgroundColor={line === origin.line ? "red" : undefined}
                  color={line === origin.line ? "white" : undefined}
                  aria-label={line === origin.line ? `Line ${line}, error` : `Line ${line}`}
                >
                  {String(line).padStart(lineWidth, " ")}:
                </Text>
              </Box>

              <Text
                key={line}
                backgroundColor={line === origin.line ? "red" : undefined}
                color={line === origin.line ? "white" : undefined}
              >
                {" " + value}
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}

      {stack ? (
        <Box marginTop={1} flexDirection="column">
          {stack.map((line) => {
            const parsedLine = parseStackLine(line);
            const lineCount = stackLineCounts.get(line) ?? 0;
            stackLineCounts.set(line, lineCount + 1);
            const key = `${line}-${lineCount}`;

            // If the line from the stack cannot be parsed, or parsed into an incomplete
            // frame without source location data (for example, "at native"), we print
            // out the unparsed line.
            if (!parsedLine?.file || !parsedLine.line || !parsedLine.column) {
              return (
                <Box key={key}>
                  <Text dimColor>- </Text>
                  <Text dimColor bold>
                    {line}
                    \t{" "}
                  </Text>
                </Box>
              );
            }

            return (
              <Box key={key}>
                <Text dimColor>- </Text>
                <Text dimColor bold>
                  {parsedLine.function}
                </Text>
                <Text
                  dimColor
                  color="gray"
                  aria-label={`at ${
                    cleanupPath(parsedLine.file) ?? ""
                  } line ${parsedLine.line} column ${parsedLine.column}`}
                >
                  {" "}
                  ({cleanupPath(parsedLine.file) ?? ""}:{parsedLine.line}:{parsedLine.column})
                </Text>
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}
