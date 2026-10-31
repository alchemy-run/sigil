import { runIssue450InitialFixture } from "../../../test/fixtures/issue-450-fixture-helpers.tsx";

runIssue450InitialFixture({
  renderedMarker: "__INITIAL_FULLSCREEN_FRAME_RENDERED__",
  lineCount: 3,
  linePrefix: "#450 initial fullscreen",
});
