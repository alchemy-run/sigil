// Vitest as an embedded engine: the explorer UI drives test discovery and
// runs through vitest's Node API and streams state changes out through a
// reporter, instead of shelling out to the CLI or the stock UI.
export type SerializedTask = {
  id: string;
  name: string;
  type: "suite" | "test";
  state: string | undefined;
  duration: number | undefined;
  errors: string[];
  tasks: SerializedTask[];
};

export type TestEngine = {
  /**
	The current task tree (files → suites → tests) with results.
	*/
  tree: () => SerializedTask[];

  running: () => boolean;

  /**
	Runs everything under the repo's test dir. Fire-and-forget; progress
	arrives via `onUpdate`.
	*/
  runAll: () => void;

  /**
	Reruns a single file, suite, or test by task id.
	*/
  runTask: (id: string) => void;

  onUpdate: (listener: () => void) => () => void;

  close: () => Promise<void>;
};

type VitestTask = {
  id: string;
  name: string;
  type: string;
  filepath?: string;
  result?: { state?: string; duration?: number; errors?: Array<{ message?: string }> };
  tasks?: VitestTask[];
};

const serializeTask = (task: VitestTask): SerializedTask => ({
  id: task.id,
  name: task.name,
  type: task.type === "test" ? "test" : "suite",
  state: task.result?.state,
  duration: task.result?.duration,
  errors: (task.result?.errors ?? [])
    .map((error) => error.message ?? "")
    .filter((message) => message.length > 0),
  tasks: (task.tasks ?? []).map(serializeTask),
});

/**
Creates a live Vitest instance scoped to the repo's own `test/` directory.
Set any environment the test workers should inherit (e.g. `SIGIL_LIVE_URL`
for live terminal mirroring) before calling this.
*/
export const createVitestEngine = async (): Promise<TestEngine> => {
  const { createVitest } = await import("vitest/node").catch((error) => {
    throw new Error(
      'The "vitest" package is required for the test engine. Install it as a dev dependency: pnpm add -D vitest',
      { cause: error },
    );
  });

  const listeners = new Set<() => void>();
  let running = false;
  let notifyTimer: ReturnType<typeof setTimeout> | undefined;

  const notify = (): void => {
    // Reporter hooks fire densely during a run; coalesce.
    notifyTimer ??= setTimeout(() => {
      notifyTimer = undefined;
      for (const listener of listeners) {
        listener();
      }
    }, 80);
  };

  const reporter = {
    onTestRunStart: () => {
      running = true;
      notify();
    },
    onTestRunEnd: () => {
      running = false;
      notify();
    },
    onTestModuleCollected: notify,
    onTestModuleEnd: notify,
    onTestSuiteResult: notify,
    onTestCaseResult: notify,
  };

  const ctx = await createVitest("test", { watch: true, reporters: [reporter] });

  const isRelevant = (moduleId: string): boolean =>
    moduleId.includes("/test/") && !moduleId.includes(".vendor");

  const relevantSpecifications = async () =>
    (await ctx.globTestSpecifications()).filter((specification) =>
      isRelevant(specification.moduleId),
    );

  // Populate the tree up front without running anything.
  await ctx.collect(["test/"]);
  notify();

  return {
    tree: () =>
      ctx.state
        .getFiles()
        .filter((file) => isRelevant((file as VitestTask).filepath ?? ""))
        .map((file) => serializeTask(file as VitestTask)),
    running: () => running,
    runAll: () => {
      if (running) {
        return;
      }

      void relevantSpecifications()
        .then((specifications) => ctx.runTestSpecifications(specifications, false))
        .catch(() => {
          running = false;
          notify();
        });
    },
    runTask: (id) => {
      if (running) {
        return;
      }

      // Present at runtime (the stock UI uses it) but absent from the
      // public Vitest type.
      const runner = ctx as unknown as { rerunTask: (taskId: string) => Promise<unknown> };
      void Promise.resolve(runner.rerunTask(id)).catch(() => {
        running = false;
        notify();
      });
    },
    onUpdate: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close: async () => {
      await ctx.close();
    },
  };
};
