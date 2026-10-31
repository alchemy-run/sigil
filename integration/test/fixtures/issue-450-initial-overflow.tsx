import { runIssue450InitialFixture } from "../../../test/fixtures/issue-450-fixture-helpers.tsx";

runIssue450InitialFixture({
  renderedMarker: "__INITIAL_OVERFLOW_FRAME_RENDERED__",
  lineCount: 4,
  linePrefix: "#450 initial overflow",
});
