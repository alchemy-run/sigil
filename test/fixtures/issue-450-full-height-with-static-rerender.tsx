import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers.tsx";

runIssue450RerenderFixture({
  includeStaticLine: true,
  heightForFrame: (rows) => rows,
});
