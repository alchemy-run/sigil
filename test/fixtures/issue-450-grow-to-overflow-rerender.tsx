import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers.tsx";

runIssue450RerenderFixture({
  frameLimit: 1,
  rowsFallback: 3,
  heightForFrame: (rows, frameCount) => (frameCount === 0 ? rows - 1 : rows + 1),
});
