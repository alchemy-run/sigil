// Derived from `code-excerpt` + `convert-to-spaces` (MIT, Vadim Demedes).

export type CodeExcerpt = {
  line: number;
  value: string;
};

const tabsToSpaces = (input: string, spaces = 2): string =>
  input.replaceAll(/^\t+/gm, (tabs) => " ".repeat(tabs.length * spaces));

const generateLineNumbers = (line: number, around: number): number[] => {
  const lineNumbers: number[] = [];

  for (let lineNumber = line - around; lineNumber <= line + around; lineNumber++) {
    lineNumbers.push(lineNumber);
  }

  return lineNumbers;
};

const codeExcerpt = (
  source: string,
  line: number,
  options: { around?: number } = {},
): CodeExcerpt[] | undefined => {
  if (!line || line < 1) {
    throw new TypeError("Line number must start from `1`.");
  }

  const lines = tabsToSpaces(source).split(/\r?\n/);

  if (line > lines.length) {
    return;
  }

  return generateLineNumbers(line, options.around ?? 3)
    .filter((lineNumber) => lines[lineNumber - 1] !== undefined)
    .map((lineNumber) => ({ line: lineNumber, value: lines[lineNumber - 1]! }));
};

export default codeExcerpt;
