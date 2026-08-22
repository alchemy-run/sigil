import { setTimeout as delay } from "node:timers/promises";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { expect, test } from "vite-plus/test";

import stripAnsi from "../src/ansi/strip.ts";
import { Box, Static, Text, render, measureElement, type DOMElement } from "../src/index.ts";
import createStdout from "./helpers/create-stdout.ts";

test("measure element", async () => {
  const stdout = createStdout();

  function Test() {
    const [width, setWidth] = useState(0);
    const ref = useRef<DOMElement>(null);

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      setWidth(measureElement(ref.current).width);
    }, []);

    return (
      <Box ref={ref}>
        <Text>Width: {width}</Text>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  expect(stdout.write.mock.calls[0][0]).toBe("Width: 0");
  await delay(100);
  expect(stdout.write.mock.lastCall![0]).toBe("Width: 100");
});

test("measure element after state update", async () => {
  const stdout = createStdout();
  let setTestItems!: (items: string[]) => void;

  function Test() {
    const [items, setItems] = useState<string[]>([]);
    const [height, setHeight] = useState(0);
    const ref = useRef<DOMElement>(null);

    setTestItems = setItems;

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      setHeight(measureElement(ref.current).height);
    }, [items.length]);

    return (
      <Box flexDirection="column">
        <Box ref={ref} flexDirection="column">
          {items.map((item) => (
            <Text key={item}>{item}</Text>
          ))}
        </Box>
        <Text>Height: {height}</Text>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  await delay(50);

  setTestItems(["line 1", "line 2", "line 3"]);
  await delay(50);

  expect(stripAnsi(stdout.write.mock.lastCall![0]).trim()).toBe(
    "line 1\nline 2\nline 3\nHeight: 3",
  );
});

test("measure element after multiple state updates", async () => {
  const stdout = createStdout();
  let setTestItems!: (items: string[]) => void;

  function Test() {
    const [items, setItems] = useState<string[]>([]);
    const [height, setHeight] = useState(0);
    const ref = useRef<DOMElement>(null);

    setTestItems = setItems;

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      setHeight(measureElement(ref.current).height);
    }, [items.length]);

    return (
      <Box flexDirection="column">
        <Box ref={ref} flexDirection="column">
          {items.map((item) => (
            <Text key={item}>{item}</Text>
          ))}
        </Box>
        <Text>Height: {height}</Text>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  await delay(50);

  setTestItems(["line 1", "line 2", "line 3"]);
  await delay(50);

  setTestItems(["line 1"]);
  await delay(50);

  expect(stripAnsi(stdout.write.mock.lastCall![0]).trim()).toBe("line 1\nHeight: 1");
});

test("measure element in useLayoutEffect after state update", async () => {
  const stdout = createStdout();
  let setTestItems!: (items: string[]) => void;

  function Test() {
    const [items, setItems] = useState<string[]>([]);
    const [height, setHeight] = useState(0);
    const ref = useRef<DOMElement>(null);

    setTestItems = setItems;

    useLayoutEffect(() => {
      if (!ref.current) {
        return;
      }

      setHeight(measureElement(ref.current).height);
    }, [items.length]);

    return (
      <Box flexDirection="column">
        <Box ref={ref} flexDirection="column">
          {items.map((item) => (
            <Text key={item}>{item}</Text>
          ))}
        </Box>
        <Text>Height: {height}</Text>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  await delay(50);

  setTestItems(["line 1", "line 2", "line 3"]);
  await delay(50);

  expect(stripAnsi(stdout.write.mock.lastCall![0]).trim()).toBe(
    "line 1\nline 2\nline 3\nHeight: 3",
  );
});

test("measure position of nested element with padding offset", async () => {
  const stdout = createStdout();

  function Test() {
    const [result, setResult] = useState("");
    const ref = useRef<DOMElement>(null);

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      const metrics = measureElement(ref.current);
      setResult(`${metrics.x},${metrics.y}`);
    }, []);

    return (
      <Box flexDirection="column">
        <Text>Header</Text>
        <Box paddingLeft={4}>
          <Box ref={ref}>
            <Text>Nested: {result}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  await delay(100);

  const lastWrite = stdout.write.mock.lastCall![0];
  expect(lastWrite.includes("Nested: 4,1")).toBe(true);
});

test("measure position of deeply nested element accumulates offsets", async () => {
  const stdout = createStdout();

  function Test() {
    const [result, setResult] = useState("");
    const ref = useRef<DOMElement>(null);

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      const metrics = measureElement(ref.current);
      setResult(`${metrics.x},${metrics.y}`);
    }, []);

    return (
      <Box paddingLeft={2} paddingTop={1}>
        <Box paddingLeft={3} paddingTop={2}>
          <Box ref={ref}>
            <Text>Deep: {result}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  await delay(100);

  const lastWrite = stdout.write.mock.lastCall![0];
  expect(lastWrite.includes("Deep: 5,3")).toBe(true);
});

test("measure position accounts for margin offset", async () => {
  const stdout = createStdout();

  function Test() {
    const [result, setResult] = useState("");
    const ref = useRef<DOMElement>(null);

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      const metrics = measureElement(ref.current);
      setResult(`${metrics.x},${metrics.y}`);
    }, []);

    return (
      <Box flexDirection="column">
        <Box marginLeft={5} marginTop={2}>
          <Box ref={ref}>
            <Text>Margin: {result}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  await delay(100);

  const lastWrite = stdout.write.mock.lastCall![0];
  expect(lastWrite.includes("Margin: 5,2")).toBe(true);
});

test("measure position — sibling offset gives correct y", async () => {
  const stdout = createStdout();

  function Test() {
    const [result, setResult] = useState("");
    const ref = useRef<DOMElement>(null);

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      const metrics = measureElement(ref.current);
      setResult(`${metrics.x},${metrics.y}`);
    }, []);

    return (
      <Box flexDirection="column">
        <Text>Line 1</Text>
        <Text>Line 2</Text>
        <Box ref={ref}>
          <Text>Third: {result}</Text>
        </Box>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  await delay(100);

  const lastWrite = stdout.write.mock.lastCall![0];
  expect(lastWrite.includes("Third: 0,2")).toBe(true);
});

test("Static does not affect layout-tree coordinates", async () => {
  const stdout = createStdout();

  function Test() {
    const [result, setResult] = useState("");
    const ref = useRef<DOMElement>(null);

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      const metrics = measureElement(ref.current);
      setResult(`${metrics.x},${metrics.y}`);
    }, []);

    return (
      <Box flexDirection="column">
        <Static items={["Static A", "Static B"]}>{(item) => <Text key={item}>{item}</Text>}</Static>
        <Box ref={ref}>
          <Text>Live: {result}</Text>
        </Box>
      </Box>
    );
  }

  render(<Test />, { stdout, debug: true });
  await delay(100);

  const lastWrite = stdout.write.mock.lastCall![0];
  // Static uses position:absolute so it doesn't affect live layout coordinates
  expect(lastWrite.includes("Live: 0,0")).toBe(true);
});

test("measure element returns zeros for node without yoga", () => {
  const node = {
    yogaNode: undefined,
    parentNode: undefined,
    nodeName: "ink-box",
    attributes: {},
    childNodes: [],
    style: {},
  } as unknown as DOMElement;

  const metrics = measureElement(node);
  expect(metrics).toEqual({ x: 0, y: 0, width: 0, height: 0 });
});

test("calculate layout while rendering is throttled", async () => {
  const stdout = createStdout();

  function Test() {
    const [width, setWidth] = useState(0);
    const ref = useRef<DOMElement>(null);

    useEffect(() => {
      if (!ref.current) {
        return;
      }

      setWidth(measureElement(ref.current).width);
    }, []);

    return (
      <Box ref={ref}>
        <Text>Width: {width}</Text>
      </Box>
    );
  }

  const { rerender } = render(null, { stdout, patchConsole: false });
  rerender(<Test />);
  await delay(50);

  const writes = stdout
    .getWrites()
    .filter((w) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
  const lastContentWrite = writes.at(-1)!;

  expect(stripAnsi(lastContentWrite).trim()).toBe("Width: 100");
});
