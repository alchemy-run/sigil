// Derived from `stack-utils` (MIT, Isaac Z. Schlueter, James Talmage),
// reduced to the `parseLine()` surface Ink's error overview uses.

export type ParsedStackLine = {
  line?: number;
  column?: number;
  file?: string;
  function?: string;
  method?: string;
  native?: boolean;
  evalOrigin?: string;
  evalFile?: string;
  evalLine?: number;
  evalColumn?: number;
};

const lineRegExp = new RegExp(
  "^" +
    // Sometimes we strip out the '    at' because it's noisy
    String.raw`(?:\s*at )?` +
    // $1 = ctor if 'new'
    "(?:(new) )?" +
    // $2 = function name (can be literally anything). May contain method at
    // the end as [as xyz]
    String.raw`(?:(.*?) \()?` +
    // (eval at <anonymous> (file.js:1:1),
    // $3 = eval origin; $4:$5:$6 are eval file/line/col
    String.raw`(?:eval at ([^ ]+) \((.+?):(\d+):(\d+)\), )?` +
    // File:line:col: $7:$8:$9; $10 = 'native' if native
    String.raw`(?:(.+?):(\d+):(\d+)|(native))` +
    // Maybe close the paren, then end. If $11 is ), then we only allow
    // balanced parens in the filename; any imbalance is placed on the fname.
    String.raw`(\)?)$`,
);

const methodRegExp = /^(.*?) \[as (.*?)]$/;

const cwd = process.cwd().replaceAll("\\", "/");

const setFile = (result: ParsedStackLine, filename: string): void => {
  if (filename) {
    filename = filename.replaceAll("\\", "/");

    if (filename.startsWith(`${cwd}/`)) {
      filename = filename.slice(cwd.length + 1);
    }

    result.file = filename;
  }
};

export const parseStackLine = (line: string): ParsedStackLine | undefined => {
  const match = lineRegExp.exec(line);

  if (!match) {
    return;
  }

  let functionName = match[2];
  const evalOrigin = match[3];
  const evalFile = match[4];
  const evalLine = Number(match[5]);
  const evalColumn = Number(match[6]);
  let file = match[7];
  const lineNumber = match[8];
  const columnNumber = match[9];
  const native = match[10] === "native";
  const closeParen = match[11] === ")";
  let method;

  const result: ParsedStackLine = {};

  if (lineNumber) {
    result.line = Number(lineNumber);
  }

  if (columnNumber) {
    result.column = Number(columnNumber);
  }

  if (closeParen && file) {
    // Make sure parens are balanced. If we have a file like
    // "asdf) [as foo] (xyz.js", then odds are that the fname should be
    // += " (asdf) [as foo]" and the file should be just "xyz.js". Walk
    // backwards from the end to find the last unbalanced (.
    let closes = 0;

    for (let index = file.length - 1; index > 0; index--) {
      if (file.charAt(index) === ")") {
        closes++;
      } else if (file.charAt(index) === "(" && file.charAt(index - 1) === " ") {
        closes--;

        if (closes === -1 && file.charAt(index - 1) === " ") {
          const before = file.slice(0, index - 1);
          const after = file.slice(index + 1);
          file = after;
          functionName += ` (${before}`;
          break;
        }
      }
    }
  }

  if (functionName) {
    const methodMatch = methodRegExp.exec(functionName);

    if (methodMatch) {
      functionName = methodMatch[1];
      method = methodMatch[2];
    }
  }

  if (file) {
    setFile(result, file);
  }

  if (evalOrigin) {
    result.evalOrigin = evalOrigin;
    result.evalLine = evalLine;
    result.evalColumn = evalColumn;
    result.evalFile = evalFile?.replaceAll("\\", "/");
  }

  if (native) {
    result.native = true;
  }

  if (functionName) {
    result.function = functionName;
  }

  if (method && functionName !== method) {
    result.method = method;
  }

  return result;
};
