/** @jsxImportSource react */
// Ported from Charm Lip Gloss's layout showcase (MIT), expressed as native
// React/Yoga layout and semantic Sigil paints rather than precomposed strings.
import React from "react";

import { adaptive, interpolateColor, linearGradient, rgb } from "#/color/index.ts";
import { Box, render, Text, useWindowSize } from "#/index.ts";

const highlight = adaptive("#874BFD", "#7D56F4");
const subtle = adaptive("#D9DCCF", "#383838");
const special = adaptive("#43BF6D", "#73F59F");
const questionGradient = linearGradient(["#EDFF82", "#F25D94"]);

function Tab({ active, children }: { readonly active?: boolean; readonly children: string }) {
  return (
    <Box
      borderStyle="round"
      borderColor={highlight}
      paddingX={1}
      backgroundColor={active ? "#6124DF" : undefined}
    >
      <Text bold={active}>{children}</Text>
    </Box>
  );
}

function Checklist({
  title,
  items,
}: {
  readonly title: string;
  readonly items: ReadonlyArray<readonly [label: string, done: boolean]>;
}) {
  return (
    <Box width={31} height={9} borderStyle="single" borderColor={subtle} flexDirection="column">
      <Box
        paddingX={1}
        borderStyle="single"
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        borderColor={subtle}
      >
        <Text bold>{title}</Text>
      </Box>
      {items.map(([label, done]) => (
        <Box key={label} paddingLeft={2}>
          <Text color={done ? special : undefined} strikethrough={done}>
            {done ? "✓ " : "  "}
            {label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function ColorGrid() {
  const topLeft = rgb(242, 93, 148);
  const bottomLeft = rgb(100, 58, 255);
  const topRight = rgb(237, 255, 130);
  const bottomRight = rgb(20, 249, 213);
  return (
    <Box flexDirection="column" marginLeft={1}>
      {Array.from({ length: 8 }, (_row, y) => {
        const amountY = y / 7;
        const left = interpolateColor(topLeft, bottomLeft, amountY);
        const right = interpolateColor(topRight, bottomRight, amountY);
        return (
          <Box key={y}>
            {Array.from({ length: 14 }, (_column, x) => (
              <Text key={x} backgroundColor={interpolateColor(left, right, x / 13)}>
                {"  "}
              </Text>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

const histories = [
  "The Romans learned from the Greeks that quinces slowly cooked with honey would set when cool. Their preserves of quince and lemon became an ancestor of marmalade.",
  "Medieval quince preserves were made in clear and fruit-pulp versions. By the seventeenth century recipes had shed many of their earlier spices.",
  "In 1524 Henry VIII received a box of marmalade from Exeter. The solid Portuguese quince paste later became a favourite of Anne Boleyn and her household.",
];
const historyAlignments = ["right", "center", "left"] as const;

function History({
  children,
  align,
}: {
  readonly children: string;
  readonly align: "left" | "center" | "right";
}) {
  return (
    <Box width={30} height={12} paddingX={2} paddingY={1} backgroundColor={highlight}>
      <Text color="#FAFAFA" wrap="wrap">
        {align === "center" ? `  ${children}` : children}
      </Text>
    </Box>
  );
}

function App() {
  const { columns } = useWindowSize();
  const width = Math.min(96, Math.max(40, columns - 1));
  return (
    <Box width={width} paddingX={2} paddingY={1} flexDirection="column">
      <Box>
        <Tab active>Lip Gloss</Tab>
        <Tab>Blush</Tab>
        <Tab>Eye Shadow</Tab>
        <Tab>Mascara</Tab>
      </Box>

      <Box marginTop={1} alignItems="center">
        <Box marginRight={3} paddingX={1} backgroundColor="#F25D94">
          <Text bold italic color="#FFF7DB">
            Sigil Gloss
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text>Style Definitions for Nice Terminal Layouts</Text>
          <Text dimColor>
            From Charm • <Text color={special}>github.com/charmbracelet/lipgloss</Text>
          </Text>
        </Box>
      </Box>

      <Box height={9} marginTop={1} justifyContent="center" alignItems="center">
        <Box
          width={58}
          borderStyle="round"
          borderColor={highlight}
          paddingY={1}
          flexDirection="column"
          alignItems="center"
        >
          <Text color={questionGradient}>Are you sure you want to eat marmalade?</Text>
          <Box marginTop={1}>
            <Box marginRight={2} paddingX={3} backgroundColor="#F25D94">
              <Text underline color="#FFF7DB">
                Yes
              </Text>
            </Box>
            <Box paddingX={3} backgroundColor="#888B7E">
              <Text color="#FFF7DB">Maybe</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Checklist
          title="Citrus Fruits to Try"
          items={[
            ["Grapefruit", true],
            ["Yuzu", true],
            ["Citron", false],
            ["Kumquat", false],
            ["Pomelo", false],
          ]}
        />
        <Checklist
          title="Lip Gloss Vendors"
          items={[
            ["Glossier", false],
            ["Claire’s Boutique", false],
            ["Nyx", true],
            ["Mac", false],
            ["Milk", true],
          ]}
        />
        {width >= 92 ? <ColorGrid /> : null}
      </Box>

      {width >= 92 ? (
        <Box marginTop={1} gap={1}>
          {histories.map((history, index) => (
            <History key={history} align={historyAlignments[index] ?? "left"}>
              {history}
            </History>
          ))}
        </Box>
      ) : null}

      <Box marginTop={1} width={width - 4} backgroundColor={subtle}>
        <Box paddingX={1} marginRight={1} backgroundColor="#FF5F87">
          <Text color="#FFFDF5">STATUS</Text>
        </Box>
        <Box flexGrow={1}>
          <Text>Ravishingly adaptive!</Text>
        </Box>
        <Box paddingX={1} backgroundColor="#A550DF">
          <Text color="#FFFDF5">UTF-8</Text>
        </Box>
        <Box paddingX={1} backgroundColor="#6124DF">
          <Text color="#FFFDF5">🍥 Fish Cake</Text>
        </Box>
      </Box>

      {width >= 92 ? (
        <Box
          position="absolute"
          left={width - 34}
          top={44}
          paddingX={6}
          paddingY={1}
          backgroundColor="#F25D94"
        >
          <Text italic color="#FFF7DB">
            Now with Compositing!
          </Text>
        </Box>
      ) : (
        <Box alignSelf="flex-end" paddingX={3} backgroundColor="#F25D94">
          <Text italic color="#FFF7DB">
            Now with Compositing!
          </Text>
        </Box>
      )}
    </Box>
  );
}

render(<App />);
