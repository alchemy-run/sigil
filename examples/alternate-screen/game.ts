// Pure game logic for the snake example, kept free of JSX so the test suite
// can import the reducer without pulling the runnable example into its
// TypeScript program.

export type Point = {
  x: number;
  y: number;
};

export type Direction = "up" | "down" | "left" | "right";

export type GameState = {
  snake: Point[];
  food: Point;
  score: number;
  gameOver: boolean;
  won: boolean;
  frame: number;
};

export type Action = { type: "tick"; direction: Direction } | { type: "restart" };

export const boardWidth = 20;
export const boardHeight = 15;

const offsets: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const initialSnake: Point[] = [
  { x: 10, y: 7 },
  { x: 9, y: 7 },
  { x: 8, y: 7 },
];

function randomPosition(exclude: Point[]): Point {
  let point = {
    x: 0,
    y: 0,
  };
  let isExcluded = true;

  while (isExcluded) {
    point = {
      x: Math.floor(Math.random() * boardWidth),
      y: Math.floor(Math.random() * boardHeight),
    };

    isExcluded = false;
    for (const segment of exclude) {
      if (segment.x === point.x && segment.y === point.y) {
        isExcluded = true;
        break;
      }
    }
  }

  return point;
}

export function createInitialState(): GameState {
  return {
    snake: initialSnake,
    food: randomPosition(initialSnake),
    score: 0,
    gameOver: false,
    won: false,
    frame: 0,
  };
}

export function gameReducer(state: GameState, action: Action): GameState {
  if (action.type === "restart") {
    return createInitialState();
  }

  if (state.gameOver) {
    return state;
  }

  const head = state.snake[0];
  const offset = offsets[action.direction];
  const newHead: Point = { x: head.x + offset.x, y: head.y + offset.y };

  // Wall collision
  if (newHead.x < 0 || newHead.x >= boardWidth || newHead.y < 0 || newHead.y >= boardHeight) {
    return { ...state, gameOver: true, won: false };
  }

  const ateFood = newHead.x === state.food.x && newHead.y === state.food.y;
  const collisionSegments = ateFood ? state.snake : state.snake.slice(0, -1);

  if (collisionSegments.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
    return { ...state, gameOver: true, won: false };
  }

  const newSnake = [newHead, ...state.snake];

  if (!ateFood) {
    newSnake.pop();
  }

  if (ateFood && newSnake.length === boardWidth * boardHeight) {
    return {
      snake: newSnake,
      food: state.food,
      score: state.score + 1,
      gameOver: true,
      won: true,
      frame: state.frame + 1,
    };
  }

  return {
    snake: newSnake,
    food: ateFood ? randomPosition(newSnake) : state.food,
    score: state.score + (ateFood ? 1 : 0),
    gameOver: false,
    won: false,
    frame: state.frame + 1,
  };
}
