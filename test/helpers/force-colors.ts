import { chalk, supportsColor } from "#/ansi/chalk.ts";

// Force chalk to output colors even in non-TTY environments for testing
export const enableTestColors = () => {
  // Force chalk to output colors
  chalk.level = 3; // Full color support (16m colors)
};

export const disableTestColors = () => {
  // Restore chalk's automatic detection
  chalk.level = supportsColor ? supportsColor.level : 0;
};
