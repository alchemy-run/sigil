import { execSync } from "node:child_process";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "../../..");

export default async function setup() {
  execSync("pnpm build:reference", { cwd: repoRoot, stdio: "inherit" });
}
