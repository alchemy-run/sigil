import React, { useReducer, useEffect, useRef, useCallback } from "react";

import { render, Text, Box, useInput, useApp, useWindowSize } from "#/index.ts";

import {
  boardWidth,
  boardHeight,
  createInitialState,
  gameReducer,
  type Direction,
  type Point,
} from "./game.ts";

const headCharacter = "🦄";
const bodyCharacter = "✨";
const foodCharacter = "🌈";
const emptyCell = "  ";
const tickMs = 150;

const rainbowColors = ["red", "#FF7F00", "yellow", "green", "cyan", "blue", "magenta"] as const;

const borderH = "─".repeat(boardWidth * 2);
const borderTop = `┌${borderH}┐`;
const borderBottom = `└${borderH}┘`;
const boardWidthChars = boardWidth * 2 + 2;

function buildBoard(snake: Point[], food: Point): string {
  const headKey = `${snake[0].x},${snake[0].y}`;
  const snakeSet = new Set(snake.map((segment) => `${segment.x},${segment.y}`));

  const rows: string[] = [borderTop];
  for (let y = 0; y < boardHeight; y++) {
    let row = "│";
    for (let x = 0; x < boardWidth; x++) {
      const key = `${x},${y}`;
      if (key === headKey) {
        row += headCharacter;
      } else if (snakeSet.has(key)) {
        row += bodyCharacter;
      } else if (food.x === x && food.y === y) {
        row += foodCharacter;
      } else {
        row += emptyCell;
      }
    }

    row += "│";
    rows.push(row);
  }

  rows.push(borderBottom);
  return rows.join("\n");
}

function SnakeGame() {
  const { exit } = useApp();
  const { columns } = useWindowSize();
  const [game, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const directionReference = useRef<Direction>("right");

  const tick = useCallback(() => {
    dispatch({ type: "tick", direction: directionReference.current });
  }, []);

  useEffect(() => {
    const timer = setInterval(tick, tickMs);
    return () => {
      clearInterval(timer);
    };
  }, [tick]);

  useInput((input, key) => {
    if (input === "q") {
      exit();
    }

    if (game.gameOver && input === "r") {
      directionReference.current = "right";
      dispatch({ type: "restart" });
      return;
    }

    if (game.gameOver) {
      return;
    }

    const { current } = directionReference;
    if (key.upArrow && current !== "down") {
      directionReference.current = "up";
    } else if (key.downArrow && current !== "up") {
      directionReference.current = "down";
    } else if (key.leftArrow && current !== "right") {
      directionReference.current = "left";
    } else if (key.rightArrow && current !== "left") {
      directionReference.current = "right";
    }
  });

  const titleColor = rainbowColors[game.frame % rainbowColors.length];
  const board = buildBoard(game.snake, game.food);
  const marginLeft = Math.max(Math.floor((columns - boardWidthChars) / 2), 0);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box justifyContent="center">
        <Text bold color={titleColor}>
          🦄 Unicorn Snake 🦄
        </Text>
      </Box>

      <Box justifyContent="center" marginTop={1}>
        <Text bold color="yellow">
          Score: {game.score}
        </Text>
      </Box>

      <Box marginLeft={marginLeft} marginTop={1}>
        <Text>{board}</Text>
      </Box>

      {game.gameOver ? (
        <Box justifyContent="center" marginTop={1}>
          <Text bold color="red">
            {game.won ? "You Win!" : "Game Over!"}{" "}
          </Text>
          <Text dimColor>r: restart | q: quit</Text>
        </Box>
      ) : (
        <Box justifyContent="center" marginTop={1}>
          <Text dimColor>Arrow keys: move | Eat {foodCharacter} to grow | q: quit</Text>
        </Box>
      )}
    </Box>
  );
}

export function runAlternateScreenExample() {
  render(<SnakeGame />, { alternateScreen: true });
}
