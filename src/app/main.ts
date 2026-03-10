import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  PREVIEW_COUNT,
  createInitialGameState,
  getCellsForPiece,
  stepGame,
  type GameState,
  type InputFrame,
  type Tetromino,
} from "../core/index.js";

const VISIBLE_ROWS = FIELD_HEIGHT - 1;
const CELL_SIZE = 24;
const BOARD_X = 32;
const BOARD_Y = 28;
const BOARD_WIDTH = FIELD_WIDTH * CELL_SIZE;
const BOARD_HEIGHT = VISIBLE_ROWS * CELL_SIZE;
const PREVIEW_BOX = 78;
const FRAME_MS = 1000 / 60;

const COLORS: Record<Tetromino, string> = {
  I: "#77f0e3",
  O: "#f3dc6b",
  T: "#cc91f5",
  S: "#92d56f",
  Z: "#f17e78",
  J: "#6f97ed",
  L: "#f2ae5b",
};

const pressedKeys = new Set<string>();

const canvasElement = document.querySelector<HTMLCanvasElement>("#game");
const statsElement = document.querySelector<HTMLDivElement>("#stats");

if (canvasElement === null || statsElement === null) {
  throw new Error("App root elements not found.");
}

const canvas: HTMLCanvasElement = canvasElement;
const stats: HTMLDivElement = statsElement;

const renderingContext = canvas.getContext("2d");
if (renderingContext === null) {
  throw new Error("Canvas 2D context is unavailable.");
}

const context: CanvasRenderingContext2D = renderingContext;

let state = createInitialGameState({ seed: 7 });
let accumulator = 0;
let previousTime = performance.now();

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX"].includes(event.code)) {
    event.preventDefault();
  }

  pressedKeys.add(event.code);

  if (state.phase === "GameOver" && event.code === "KeyR") {
    state = createInitialGameState({ seed: 7 });
  }
});

window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
});

function buildInputFrame(): InputFrame {
  return {
    left: pressedKeys.has("ArrowLeft"),
    right: pressedKeys.has("ArrowRight"),
    rotateCW: pressedKeys.has("KeyX"),
    rotateCCW: pressedKeys.has("KeyZ"),
    up: pressedKeys.has("ArrowUp"),
    down: pressedKeys.has("ArrowDown"),
  };
}

function drawCell(x: number, y: number, fill: string): void {
  context.fillStyle = fill;
  context.fillRect(x, y, CELL_SIZE, CELL_SIZE);

  context.strokeStyle = "rgba(238, 241, 223, 0.1)";
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
}

function drawBoardGrid(): void {
  context.fillStyle = "#131710";
  context.fillRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);

  context.strokeStyle = "#4a5540";
  context.lineWidth = 2;
  context.strokeRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);

  context.strokeStyle = "rgba(238, 241, 223, 0.06)";
  context.lineWidth = 1;

  for (let x = 1; x < FIELD_WIDTH; x += 1) {
    const gridX = BOARD_X + x * CELL_SIZE + 0.5;
    context.beginPath();
    context.moveTo(gridX, BOARD_Y);
    context.lineTo(gridX, BOARD_Y + BOARD_HEIGHT);
    context.stroke();
  }

  for (let y = 1; y < VISIBLE_ROWS; y += 1) {
    const gridY = BOARD_Y + y * CELL_SIZE + 0.5;
    context.beginPath();
    context.moveTo(BOARD_X, gridY);
    context.lineTo(BOARD_X + BOARD_WIDTH, gridY);
    context.stroke();
  }
}

function drawField(currentState: GameState): void {
  for (let y = 1; y < currentState.field.length; y += 1) {
    for (let x = 0; x < currentState.field[y].length; x += 1) {
      const cell = currentState.field[y][x];
      if (cell === null) {
        continue;
      }

      drawCell(BOARD_X + x * CELL_SIZE, BOARD_Y + (y - 1) * CELL_SIZE, COLORS[cell]);
    }
  }
}

function drawActivePiece(currentState: GameState): void {
  const activePiece = currentState.activePiece;
  if (activePiece === null) {
    return;
  }

  for (const cell of getCellsForPiece(activePiece)) {
    const y = activePiece.y + cell.y;
    if (y < 1) {
      continue;
    }

    drawCell(
      BOARD_X + (activePiece.x + cell.x) * CELL_SIZE,
      BOARD_Y + (y - 1) * CELL_SIZE,
      COLORS[activePiece.type],
    );
  }
}

function drawPreviewPiece(type: Tetromino, x: number, y: number): void {
  const previewPiece = {
    type,
    rotation: "spawn" as const,
    x: 0,
    y: 0,
    gravityAccumulator: 0,
    grounded: false,
    lockDelayRemaining: 0,
  };

  const cells = getCellsForPiece(previewPiece);
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  const offsetX = x + Math.floor((PREVIEW_BOX - (maxX + 1) * CELL_SIZE) / 2);
  const offsetY = y + Math.floor((PREVIEW_BOX - (maxY + 1) * CELL_SIZE) / 2);

  for (const cell of cells) {
    drawCell(offsetX + cell.x * CELL_SIZE, offsetY + cell.y * CELL_SIZE, COLORS[type]);
  }
}

function drawPreviews(currentState: GameState): void {
  context.fillStyle = "#192017";
  context.fillRect(BOARD_X + BOARD_WIDTH + 26, BOARD_Y, 110, 276);

  context.strokeStyle = "#4a5540";
  context.lineWidth = 2;
  context.strokeRect(BOARD_X + BOARD_WIDTH + 26, BOARD_Y, 110, 276);

  context.fillStyle = "#d4bb63";
  context.font = '12px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
  context.fillText("NEXT", BOARD_X + BOARD_WIDTH + 42, BOARD_Y + 20);

  const previews = currentState.queue.slice(0, PREVIEW_COUNT);
  previews.forEach((type, index) => {
    const boxX = BOARD_X + BOARD_WIDTH + 42;
    const boxY = BOARD_Y + 34 + index * 84;

    context.fillStyle = "#0f130f";
    context.fillRect(boxX, boxY, PREVIEW_BOX, PREVIEW_BOX);
    context.strokeStyle = "rgba(238, 241, 223, 0.12)";
    context.strokeRect(boxX + 0.5, boxY + 0.5, PREVIEW_BOX - 1, PREVIEW_BOX - 1);
    drawPreviewPiece(type, boxX, boxY);
  });
}

function renderStats(currentState: GameState): void {
  stats.innerHTML = [
    ["Phase", currentState.phase],
    ["Pieces", String(currentState.pieceCount)],
    ["Gravity", String(currentState.gravityInternal)],
    ["Active", currentState.activePiece?.type ?? "none"],
    ["Lock", currentState.activePiece ? String(currentState.activePiece.lockDelayRemaining) : "-"],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat-row"><span>${label}</span><strong>${value}</strong></div>`,
    )
    .join("");
}

function render(currentState: GameState): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#10120e";
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawBoardGrid();
  drawField(currentState);
  drawActivePiece(currentState);
  drawPreviews(currentState);

  if (currentState.phase === "GameOver") {
    context.fillStyle = "rgba(0, 0, 0, 0.65)";
    context.fillRect(BOARD_X, BOARD_Y + 180, BOARD_WIDTH, 96);
    context.fillStyle = "#eef1df";
    context.font = '18px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("GAME OVER", BOARD_X + 110, BOARD_Y + 218);
    context.fillStyle = "#a9b09b";
    context.font = '12px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("Press R to restart", BOARD_X + 104, BOARD_Y + 244);
  }

  renderStats(currentState);
}

function loop(now: number): void {
  accumulator += now - previousTime;
  previousTime = now;

  while (accumulator >= FRAME_MS) {
    state = stepGame(state, buildInputFrame());
    accumulator -= FRAME_MS;
  }

  render(state);
  requestAnimationFrame(loop);
}

render(state);
requestAnimationFrame(loop);
