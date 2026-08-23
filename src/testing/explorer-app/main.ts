// The explorer frontend — a Vite app. Terminals are real xterm.js instances
// with the full addon set (Unicode 11 widths so emoji align exactly like
// Sigil lays them out, clickable links, OSC 52 clipboard, sixel images, and
// WebGL + fit on the dedicated terminal view).
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";

import "@xterm/xterm/css/xterm.css";
import "./style.css";

type Config = {
  mode: "explorer" | "terminal";
  title: string;
  columns: number;
  rows: number;
  tests: boolean;
  entries: Array<{ id: string; title: string; group: string }>;
};

type SerializedTask = {
  id: string;
  name: string;
  type: "suite" | "test";
  state: string | undefined;
  duration: number | undefined;
  errors: string[];
  tasks: SerializedTask[];
};

const root = document.getElementById("root")!;

const createTerminal = (
  columns: number,
  rows: number,
  { webgl = false }: { webgl?: boolean } = {},
): Terminal => {
  const terminal = new Terminal({
    cols: columns,
    rows,
    fontFamily: "monospace",
    allowProposedApi: true,
    linkHandler: {
      activate: (_event, uri) => {
        window.open(uri, "_blank");
      },
    },
  });
  terminal.loadAddon(new Unicode11Addon());
  terminal.unicode.activeVersion = "11";
  terminal.loadAddon(new WebLinksAddon((_event, uri) => window.open(uri, "_blank")));
  terminal.loadAddon(new ClipboardAddon());
  terminal.loadAddon(new ImageAddon());
  if (webgl) {
    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // WebGL unavailable — the DOM renderer takes over.
    }
  }

  return terminal;
};

const terminalText = (terminal: Terminal): string => {
  const buffer = terminal.buffer.active;
  const lines: string[] = [];
  for (let y = 0; y < terminal.rows; y++) {
    lines.push(
      buffer
        .getLine(buffer.viewportY + y)
        ?.translateToString(true)
        .trimEnd() ?? "",
    );
  }

  return lines.join("\n").replace(/\n+$/, "");
};

// ── Terminal view: one app, full window, fit + resize ───────────────────────

const terminalView = (config: Config, appId: string): void => {
  const entry = config.entries.find((candidate) => candidate.id === appId);
  const title = entry ? `${config.title} — ${entry.title}` : config.title;
  document.title = title;

  root.innerHTML = `<div class="terminal-view">
    <header><span>${""}</span><a href="/">↩ index</a></header>
    <div class="terminal-host"></div>
  </div>`;
  root.querySelector("header span")!.textContent = title;

  const terminal = createTerminal(config.columns, config.rows, { webgl: true });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(root.querySelector<HTMLElement>(".terminal-host")!);
  terminal.focus();

  const socket = new WebSocket(`ws://${location.host}/pty?app=${encodeURIComponent(appId)}`);
  const send = (message: object): void => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  socket.onopen = () => {
    fit.fit();
    send({ type: "resize", columns: terminal.cols, rows: terminal.rows });
  };
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data as string) as {
      type: string;
      data?: string;
      code?: number;
    };
    if (message.type === "data" && message.data !== undefined) {
      terminal.write(message.data);
    }

    if (message.type === "exit") {
      terminal.write(`\r\n[process exited ${message.code} — reload to restart]`);
    }
  };
  terminal.onData((data) => {
    send({ type: "data", data });
  });

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fit.fit();
      send({ type: "resize", columns: terminal.cols, rows: terminal.rows });
    }, 100);
  }).observe(root.querySelector(".terminal-host")!);

  // For browser automation: read the screen, send input directly.
  Object.assign(window, {
    sigil: {
      term: terminal,
      ws: socket,
      send: (data: string) => send({ type: "data", data }),
      text: () => terminalText(terminal),
    },
  });
};

// ── Explorer view: test tree + live sessions + examples ─────────────────────

const explorerView = (config: Config): void => {
  document.title = config.title;

  const groups = new Map<string, Config["entries"]>();
  for (const entry of config.entries) {
    groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry]);
  }

  const exampleSections = [...groups.entries()]
    .map(
      ([group, entries]) =>
        `<section><h2>${group}</h2><ul>` +
        entries
          .map(
            (entry) =>
              `<li><a href="/terminal?app=${encodeURIComponent(entry.id)}" target="_blank"></a></li>`,
          )
          .join("") +
        "</ul></section>",
    )
    .join("");

  root.innerHTML = `<div class="layout">
    <div class="sidebar">
      <h1></h1>
      <p>Examples open as live terminals. Test runs stream their terminals into the panel on the right.</p>
      ${config.tests ? '<section><h2>Tests <button id="run-all">run all</button><span id="run-state"></span></h2><div id="tests"></div></section>' : ""}
      ${exampleSections}
    </div>
    <div class="main">
      <h2>Live terminals</h2>
      <p id="empty">Nothing yet — run a test on the left, or open an example.</p>
      <div id="sessions"></div>
    </div>
  </div>`;
  root.querySelector("h1")!.textContent = config.title;
  // Entry titles set via textContent to avoid trusting server strings in HTML.
  const links = [...root.querySelectorAll<HTMLAnchorElement>("section ul a")];
  const flat = [...groups.values()].flat();
  for (const [index, link] of links.entries()) {
    link.textContent = flat[index]!.title;
  }

  // Sessions panel.
  const sessionsContainer = document.getElementById("sessions")!;
  const sessions = new Map<string, { term: Terminal; element: HTMLElement }>();

  type Session = {
    id: string;
    title: string;
    columns: number;
    rows: number;
    data?: string;
    done?: boolean;
    exitCode?: number;
  };

  const finishSession = (id: string, code: number | undefined): void => {
    const session = sessions.get(id);
    if (!session) {
      return;
    }

    session.element.classList.add("done");
    if (code !== 0 && code !== undefined) {
      session.element.classList.add("failed");
    }

    session.element.querySelector(".status")!.textContent =
      code === undefined ? "closed" : `exited ${code}`;
  };

  const createSession = (session: Session): void => {
    document.getElementById("empty")!.style.display = "none";
    const element = document.createElement("div");
    element.className = "session";
    element.innerHTML =
      '<div class="bar"><span class="title"></span><span class="status">running</span></div><div class="body"></div>';
    element.querySelector(".title")!.textContent = session.title;
    sessionsContainer.prepend(element);
    const term = createTerminal(session.columns, session.rows);
    term.open(element.querySelector<HTMLElement>(".body")!);
    if (session.data) {
      term.write(session.data);
    }

    sessions.set(session.id, { term, element });
    if (session.done) {
      finishSession(session.id, session.exitCode);
    }

    while (sessionsContainer.children.length > 12) {
      sessionsContainer.lastChild?.remove();
    }
  };

  // Tests panel.
  const testsContainer = document.getElementById("tests");
  const run = (id?: string): void => {
    void fetch(`/api/run${id ? `?task=${encodeURIComponent(id)}` : ""}`, { method: "POST" });
  };

  const renderTask = (task: SerializedTask): HTMLElement => {
    const element = document.createElement("div");
    element.className = "task";
    const row = document.createElement("div");
    row.className = "row";
    const dot = document.createElement("span");
    dot.className = `dot ${task.state === "pass" ? "pass" : task.state === "fail" ? "fail" : task.state === "run" ? "run" : ""}`;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = task.name;
    const time = document.createElement("span");
    time.className = "time";
    if (task.duration !== undefined) {
      time.textContent = `${Math.round(task.duration)}ms`;
    }

    const runButton = document.createElement("button");
    runButton.className = "run";
    runButton.textContent = "▶";
    runButton.onclick = () => {
      run(task.id);
    };

    row.append(dot, name, time, runButton);
    element.append(row);
    for (const error of task.errors) {
      const errorElement = document.createElement("div");
      errorElement.className = "error";
      errorElement.textContent = error;
      element.append(errorElement);
    }

    if (task.tasks.length > 0) {
      const children = document.createElement("div");
      children.className = "children";
      for (const child of task.tasks) {
        children.append(renderTask(child));
      }

      element.append(children);
    }

    return element;
  };

  const renderTests = (files: SerializedTask[], running: boolean): void => {
    if (!testsContainer) {
      return;
    }

    testsContainer.replaceChildren(...files.map(renderTask));
    document.getElementById("run-state")!.textContent = running ? "running…" : "";
    (document.getElementById("run-all") as HTMLButtonElement).disabled = running;
  };

  document.getElementById("run-all")?.addEventListener("click", () => {
    run();
  });

  const socket = new WebSocket(`ws://${location.host}/live/watch`);
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data as string) as {
      type: string;
      id?: string;
      title?: string;
      code?: number;
      data?: string;
      sessions?: Session[];
      tests?: SerializedTask[];
      files?: SerializedTask[];
      running?: boolean;
    };
    if (message.type === "init") {
      for (const session of message.sessions ?? []) {
        createSession(session);
      }

      if (message.tests) {
        renderTests(message.tests, message.running ?? false);
      }
    }

    if (message.type === "start") {
      createSession(message as unknown as Session);
    }

    if (message.type === "data" && message.id !== undefined && message.data !== undefined) {
      sessions.get(message.id)?.term.write(message.data);
    }

    if (message.type === "title" && message.id !== undefined) {
      const session = sessions.get(message.id);
      if (session) {
        session.element.querySelector(".title")!.textContent = message.title ?? "";
      }
    }

    if (message.type === "end" && message.id !== undefined) {
      finishSession(message.id, message.code);
    }
  };

  // For browser automation.
  Object.assign(window, {
    sigilExplorer: {
      sessions,
      text: (id: string) => {
        const session = sessions.get(id);
        return session ? terminalText(session.term) : undefined;
      },
    },
  });
};

// ── Boot ────────────────────────────────────────────────────────────────────

const config = (await fetch("/api/config").then((response) => response.json())) as Config;
const params = new URLSearchParams(location.search);

if (location.pathname === "/terminal") {
  terminalView(config, params.get("app") ?? config.entries[0]?.id ?? "");
} else if (config.mode === "terminal") {
  terminalView(config, config.entries[0]?.id ?? "");
} else {
  explorerView(config);
}
