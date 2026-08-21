import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers.tsx";

runIssue450RerenderFixture({
  includeStaticLine: true,
  heightForFrame: (rows, frameCount) => (frameCount < 2 ? rows : rows - 1),
});
