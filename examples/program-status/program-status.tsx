import React, { useEffect, useState } from "react";

import {
  render,
  useApp,
  useCapabilities,
  useInput,
  useProgramStatus,
  Box,
  Text,
  type ProgramStatusMode,
} from "#/index.ts";

// Simulates a two-region deploy that reports OSC 7501 program status:
// working with progress, blocked on an approval, then done or error.
// Run with `--force` to send reports even if the terminal doesn't answer
// the support query.

type Phase = "deploying" | "approval" | "done" | "error";

const regions = ["us", "eu"] as const;
const app = "sigil-example";

function Region({ id, progress }: { readonly id: string; readonly progress: number }) {
  useProgramStatus(
    progress < 100
      ? { state: "working", id: `deploy/${id}`, app, progress, msg: `Deploying ${id}` }
      : undefined,
  );
  return (
    <Text>
      {id}: {progress < 100 ? `${progress}%` : "ready"}
    </Text>
  );
}

function ProgramStatusExample() {
  const { exit } = useApp();
  const capabilities = useCapabilities();
  const [phase, setPhase] = useState<Phase>("deploying");
  const [progress, setProgress] = useState({ us: 0, eu: 0 });

  useEffect(() => {
    if (phase !== "deploying") return;
    const timer = setInterval(() => {
      setProgress((previous) => {
        const next = {
          us: Math.min(100, previous.us + 7),
          eu: Math.min(100, previous.eu + 4),
        };
        if (next.us === 100 && next.eu === 100) setPhase("approval");
        return next;
      });
    }, 300);
    return () => {
      clearInterval(timer);
    };
  }, [phase]);

  const overall = Math.round((progress.us + progress.eu) / 2);
  useProgramStatus(
    phase === "deploying"
      ? { state: "working", id: "deploy", app, progress: overall, title: "Deploy" }
      : phase === "approval"
        ? { state: "blocked", id: "deploy", app, kind: "permission", msg: "Approve release?" }
        : phase === "done"
          ? { state: "done", id: "deploy", app, msg: "Released to us, eu" }
          : { state: "error", id: "deploy", app, msg: "Release rejected" },
  );

  useInput((input) => {
    if (input === "q") exit();
    if (phase === "approval" && input === "y") setPhase("done");
    if (phase === "approval" && input === "n") setPhase("error");
    if ((phase === "done" || phase === "error") && input === "r") {
      setProgress({ us: 0, eu: 0 });
      setPhase("deploying");
    }
  });

  const supported = capabilities.supports.programStatus;
  return (
    <Box flexDirection="column">
      <Text dimColor>
        Terminal OSC 7501 support:{" "}
        {supported === undefined ? "checking…" : supported ? "yes" : "no"}
      </Text>
      <Text bold>Deploy {phase === "deploying" ? `${overall}%` : phase}</Text>
      {phase === "deploying" &&
        regions.map((id) => <Region key={id} id={id} progress={progress[id]} />)}
      {phase === "approval" && <Text color="yellow">Approve release? (y/n)</Text>}
      {phase === "done" && <Text color="green">Released. Press r to run again.</Text>}
      {phase === "error" && <Text color="red">Rejected. Press r to run again.</Text>}
      <Text dimColor>Press q to quit.</Text>
    </Box>
  );
}

const programStatus: ProgramStatusMode = process.argv.includes("--force") ? "enabled" : "auto";

render(<ProgramStatusExample />, { programStatus });
