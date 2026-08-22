import term from "./term.ts";

// Convenience wrapper over `term`: run a fixture to completion and return
// everything it wrote to the pty.
export const run = async (
  fixture: string,
  props?: { env?: Record<string, string>; columns?: number },
): Promise<string> => {
  const ps = term(fixture, [], { env: props?.env, columns: props?.columns });
  await ps.waitForExit();
  return ps.output;
};
