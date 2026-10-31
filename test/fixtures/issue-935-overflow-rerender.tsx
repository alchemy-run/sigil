import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers.tsx";

// Pre-existing terminal output that must survive overflowing rerenders.
const rows = Number(process.argv[2]) || 6;
for (let index = 0; index < rows; index++) {
  process.stdout.write(`#935 scrollback ${index}\n`);
}

runIssue450RerenderFixture({
  // Overflow by exactly one row, so the label row stays in the viewport.
  heightForFrame: (viewportRows) => viewportRows + 1,
  // One frame's label is longer than the others, so an incomplete clear leaves
  // its tail behind (`#450 topSTALE-ROW`) instead of being overwritten.
  labelForFrame: (frameCount) => (frameCount === 7 ? "frame 7 STALE-ROW" : `frame ${frameCount}`),
});
