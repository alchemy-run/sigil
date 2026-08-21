// Derived from `is-in-ci` (MIT, Sindre Sorhus).
import process from "node:process";

const check = (key: string): boolean =>
  key in process.env && process.env[key] !== "0" && process.env[key] !== "false";

const isInCi = check("CI") || check("CONTINUOUS_INTEGRATION");

export default isInCi;
