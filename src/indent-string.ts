// Derived from `indent-string` (MIT, Sindre Sorhus), reduced to the surface Ink uses.
const indentString = (
  string: string,
  count = 1,
  options: { indent?: string; includeEmptyLines?: boolean } = {},
): string => {
  const { indent = " ", includeEmptyLines = false } = options;

  if (count === 0) {
    return string;
  }

  const regex = includeEmptyLines ? /^/gm : /^(?!\s*$)/gm;

  return string.replace(regex, indent.repeat(count));
};

export default indentString;
