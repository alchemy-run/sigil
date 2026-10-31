import { runIssue450RerenderFixture } from "../../../test/fixtures/issue-450-fixture-helpers.tsx";

runIssue450RerenderFixture({
  heightForFrame: (rows, frameCount) => (frameCount === 0 ? rows + 1 : rows - 1),
});
