import { runIssue450RerenderFixture } from "../../../test/fixtures/issue-450-fixture-helpers.tsx";

runIssue450RerenderFixture({
  heightForFrame: (rows, frameCount) => (frameCount < 2 ? rows : rows - 1),
});
