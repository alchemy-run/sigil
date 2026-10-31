import { runIssue450RerenderFixture } from "../../../test/fixtures/issue-450-fixture-helpers.tsx";

runIssue450RerenderFixture({
  heightForFrame: (rows) => rows - 1,
});
