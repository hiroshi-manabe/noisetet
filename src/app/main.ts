import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  getCellsForPiece,
  stepGame,
  type InputFrame,
  type Tetromino,
} from "../core/index.js";
import { createHudTextures } from "./hudTextures.js";
import {
  BOOT_MODE_ENV_KEY,
  BOOT_MODE_STORAGE_KEY,
  createBootSession,
  isDebugMode,
  resolveBootModeFromSources,
  type BootMode,
} from "./mode.js";
import {
  createPresentationState,
  updatePresentationState,
  type PresentationState,
  type PresentationView,
} from "../presentation/index.js";

const VISIBLE_ROWS = FIELD_HEIGHT - 1;
const CELL_SIZE = 24;
const BOARD_X = 32;
const BOARD_Y = 28;
const BOARD_WIDTH = FIELD_WIDTH * CELL_SIZE;
const BOARD_HEIGHT = VISIBLE_ROWS * CELL_SIZE;
const PREVIEW_BOX = 78;
const FRAME_MS = 1000 / 60;
const HUD_PANEL_X = BOARD_X + BOARD_WIDTH + 26;
const HUD_PANEL_Y = BOARD_Y + 292;
const HUD_PANEL_WIDTH = 110;
const HUD_PANEL_HEIGHT = 212;
const LABEL_BLINK_FRAMES = 30;
const SCORE_DISPLAY_DIGITS = 5;
const SCORE_DISPLAY_MAX = 99999;
const PIECES_DISPLAY_DIGITS = 3;
const PIECES_DISPLAY_MAX = 999;

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

const shellElement = document.querySelector<HTMLElement>("#shell");
const sidebarElement = document.querySelector<HTMLElement>("#sidebar");
const subtitleElement = document.querySelector<HTMLElement>("#subtitle");
const canvasElement = document.querySelector<HTMLCanvasElement>("#game");
const statsElement = document.querySelector<HTMLDivElement>("#stats");

if (
  shellElement === null ||
  sidebarElement === null ||
  subtitleElement === null ||
  canvasElement === null ||
  statsElement === null
) {
  throw new Error("App root elements not found.");
}

const shell: HTMLElement = shellElement;
const sidebar: HTMLElement = sidebarElement;
const subtitle: HTMLElement = subtitleElement;
const canvas: HTMLCanvasElement = canvasElement;
const stats: HTMLDivElement = statsElement;

const renderingContext = canvas.getContext("2d");
if (renderingContext === null) {
  throw new Error("Canvas 2D context is unavailable.");
}

const context: CanvasRenderingContext2D = renderingContext;
const hudTextures = createHudTextures();

function readBootMode(): BootMode {
  try {
    return resolveBootModeFromSources(
      import.meta.env[BOOT_MODE_ENV_KEY],
      window.localStorage.getItem(BOOT_MODE_STORAGE_KEY),
    );
  } catch {
    return "normal";
  }
}

const bootSession = createBootSession(readBootMode(), 7);
const debugMode = isDebugMode(bootSession.mode);

let state = bootSession.state;
let presentationState: PresentationState = createPresentationState(state);
let isPaused = bootSession.paused;
let elapsedGameplayMs = 0;
let uiAnimationFrames = 0;
let accumulator = 0;
let previousTime = performance.now();

if (!debugMode) {
  sidebar.style.display = "none";
  shell.style.gridTemplateColumns = "1fr";
  shell.style.width = "min(700px, calc(100vw - 32px))";
}

subtitle.textContent =
  bootSession.mode === "normal"
    ? "Solid Theme Prototype"
    : bootSession.mode === "debug20g"
      ? "Solid Theme Debug 20G"
      : "Solid Theme Debug";

window.addEventListener("keydown", (event) => {
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX", "KeyC", "KeyP"].includes(
      event.code,
    )
  ) {
    event.preventDefault();
  }

  pressedKeys.add(event.code);

  if (event.code === "KeyP" && !event.repeat && state.phase !== "GameOver") {
    isPaused = !isPaused;
    accumulator = 0;
    pressedKeys.clear();
    return;
  }

  if (state.phase === "GameOver" && event.code === "KeyR") {
    state = createBootSession(bootSession.mode, 7).state;
    presentationState = createPresentationState(state);
    isPaused = false;
    elapsedGameplayMs = 0;
    uiAnimationFrames = 0;
    accumulator = 0;
    pressedKeys.clear();
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
    rotateCCW: pressedKeys.has("KeyZ") || pressedKeys.has("KeyC"),
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

function drawBoardGrid(view: PresentationView): void {
  const originX = BOARD_X + view.shakeOffset.x;
  const originY = BOARD_Y + view.shakeOffset.y;

  context.fillStyle = "#131710";
  context.fillRect(originX, originY, BOARD_WIDTH, BOARD_HEIGHT);

  context.strokeStyle = "#4a5540";
  context.lineWidth = 2;
  context.strokeRect(originX, originY, BOARD_WIDTH, BOARD_HEIGHT);

  context.strokeStyle = "rgba(238, 241, 223, 0.06)";
  context.lineWidth = 1;

  for (let x = 1; x < FIELD_WIDTH; x += 1) {
    const gridX = originX + x * CELL_SIZE + 0.5;
    context.beginPath();
    context.moveTo(gridX, originY);
    context.lineTo(gridX, originY + BOARD_HEIGHT);
    context.stroke();
  }

  for (let y = 1; y < VISIBLE_ROWS; y += 1) {
    const gridY = originY + y * CELL_SIZE + 0.5;
    context.beginPath();
    context.moveTo(originX, gridY);
    context.lineTo(originX + BOARD_WIDTH, gridY);
    context.stroke();
  }
}

function drawField(view: PresentationView): void {
  const originX = BOARD_X + view.shakeOffset.x;
  const originY = BOARD_Y + view.shakeOffset.y;

  for (let y = 1; y < view.field.length; y += 1) {
    for (let x = 0; x < view.field[y].length; x += 1) {
      const cell = view.field[y][x];
      if (cell === null) {
        continue;
      }

      drawCell(originX + x * CELL_SIZE, originY + (y - 1) * CELL_SIZE, COLORS[cell]);
    }
  }
}

function drawActivePiece(view: PresentationView): void {
  const activePiece = view.activePiece;
  if (activePiece === null) {
    return;
  }

  const originX = BOARD_X + view.shakeOffset.x;
  const originY = BOARD_Y + view.shakeOffset.y;

  for (const cell of getCellsForPiece(activePiece)) {
    const y = activePiece.y + cell.y;
    if (y < 1) {
      continue;
    }

    drawCell(
      originX + (activePiece.x + cell.x + view.activePieceOffset.x) * CELL_SIZE,
      originY + (y - 1 + view.activePieceOffset.y) * CELL_SIZE,
      COLORS[activePiece.type],
    );
  }
}

function drawLineClearRows(view: PresentationView): void {
  if (view.lineClearRows.length === 0) {
    return;
  }

  const originX = BOARD_X + view.shakeOffset.x;
  const originY = BOARD_Y + view.shakeOffset.y;

  for (const row of view.lineClearRows) {
    if (row.y < 1) {
      continue;
    }

    for (const cell of row.cells) {
      drawCell(
        originX + (cell.x + row.xOffsetCells) * CELL_SIZE,
        originY + (row.y - 1) * CELL_SIZE,
        COLORS[cell.type],
      );
    }
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

function drawPreviews(view: PresentationView): void {
  context.fillStyle = "#192017";
  context.fillRect(BOARD_X + BOARD_WIDTH + 26, BOARD_Y, 110, 276);

  context.strokeStyle = "#4a5540";
  context.lineWidth = 2;
  context.strokeRect(BOARD_X + BOARD_WIDTH + 26, BOARD_Y, 110, 276);

  context.fillStyle = "#d4bb63";
  context.font = '12px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
  context.fillText("NEXT", BOARD_X + BOARD_WIDTH + 42, BOARD_Y + 20);

  view.queuePreviews.forEach((preview) => {
    const boxX = BOARD_X + BOARD_WIDTH + 42;
    const boxY = BOARD_Y + 34 + (preview.index + preview.yOffsetSlots) * 84;

    context.fillStyle = "#0f130f";
    context.fillRect(boxX, boxY, PREVIEW_BOX, PREVIEW_BOX);
    context.strokeStyle = "rgba(238, 241, 223, 0.12)";
    context.strokeRect(boxX + 0.5, boxY + 0.5, PREVIEW_BOX - 1, PREVIEW_BOX - 1);
    drawPreviewPiece(preview.type, boxX, boxY);
  });
}

function drawTexturedNumber(value: number, x: number, y: number, slots: number, maxValue: number): void {
  const clampedValue = Math.min(maxValue, Math.max(0, Math.floor(value)));
  const digits = String(clampedValue);
  const slotWidth = hudTextures.digitWidth;
  const totalWidth = slots * slotWidth;
  let cursorX = x + totalWidth - digits.length * slotWidth;

  for (const digit of digits) {
    const texture = hudTextures.digits[digit];
    context.drawImage(texture, cursorX, y, hudTextures.digitWidth, hudTextures.digitHeight);
    cursorX += slotWidth;
  }
}

function shouldDrawBlinkLabel(): boolean {
  const phase = uiAnimationFrames % (LABEL_BLINK_FRAMES * 2);
  return phase < LABEL_BLINK_FRAMES;
}

function drawHudLabel(texture: HTMLCanvasElement, x: number, y: number): void {
  context.drawImage(texture, x, y);
}

function drawUserHud(view: PresentationView): void {
  context.fillStyle = "#192017";
  context.fillRect(HUD_PANEL_X, HUD_PANEL_Y, HUD_PANEL_WIDTH, HUD_PANEL_HEIGHT);

  context.strokeStyle = "#4a5540";
  context.lineWidth = 2;
  context.strokeRect(HUD_PANEL_X, HUD_PANEL_Y, HUD_PANEL_WIDTH, HUD_PANEL_HEIGHT);

  const drawBlinkLabel = shouldDrawBlinkLabel();
  const labelX = HUD_PANEL_X + 8;
  const digitsX = HUD_PANEL_X + 8;

  if (drawBlinkLabel) {
    drawHudLabel(hudTextures.labels.score, labelX, HUD_PANEL_Y + 12);
  }
  drawTexturedNumber(view.score, digitsX, HUD_PANEL_Y + 48, SCORE_DISPLAY_DIGITS, SCORE_DISPLAY_MAX);

  if (drawBlinkLabel) {
    drawHudLabel(hudTextures.labels.pieces, labelX, HUD_PANEL_Y + 104);
  }
  drawTexturedNumber(
    view.pieceCount,
    digitsX + (SCORE_DISPLAY_DIGITS - PIECES_DISPLAY_DIGITS) * hudTextures.digitWidth,
    HUD_PANEL_Y + 140,
    PIECES_DISPLAY_DIGITS,
    PIECES_DISPLAY_MAX,
  );
}

function renderStats(view: PresentationView, paused: boolean, elapsedMs: number): void {
  stats.innerHTML = [
    ["Mode", bootSession.mode],
    ["Paused", paused ? "yes" : "no"],
    ["ElapsedMs", String(Math.floor(elapsedMs))],
    ["Phase", view.phase],
    ["Score", String(view.score)],
    ["Pieces", String(view.pieceCount)],
    ["Gravity", String(view.gravityInternal)],
    ["Active", view.activePiece?.type ?? "none"],
    ["Lock", view.lockDelayRemaining === null ? "-" : String(view.lockDelayRemaining)],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat-row"><span>${label}</span><strong>${value}</strong></div>`,
    )
    .join("");
}

function render(view: PresentationView): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#10120e";
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawBoardGrid(view);
  drawField(view);
  drawActivePiece(view);
  drawLineClearRows(view);
  drawPreviews(view);
  drawUserHud(view);

  if (view.phase === "GameOver") {
    context.fillStyle = "rgba(0, 0, 0, 0.65)";
    context.fillRect(BOARD_X, BOARD_Y + 180, BOARD_WIDTH, 96);
    context.fillStyle = "#eef1df";
    context.font = '18px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("GAME OVER", BOARD_X + 110, BOARD_Y + 218);
    context.fillStyle = "#a9b09b";
    context.font = '12px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("Press R to restart", BOARD_X + 104, BOARD_Y + 244);
  }

  if (isPaused) {
    context.fillStyle = "rgba(0, 0, 0, 0.65)";
    context.fillRect(BOARD_X, BOARD_Y + 180, BOARD_WIDTH, 96);
    context.fillStyle = "#eef1df";
    context.font = '18px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("PAUSED", BOARD_X + 132, BOARD_Y + 218);
    context.fillStyle = "#a9b09b";
    context.font = '12px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("Press P to resume", BOARD_X + 100, BOARD_Y + 244);
  }

  if (debugMode) {
    renderStats(view, isPaused, elapsedGameplayMs);
  }
}

function loop(now: number): void {
  accumulator += now - previousTime;
  previousTime = now;

  if (isPaused) {
    accumulator = 0;
    render(presentationState.view);
    requestAnimationFrame(loop);
    return;
  }

  while (accumulator >= FRAME_MS) {
    const previousState = state;
    state = stepGame(state, buildInputFrame());
    presentationState = updatePresentationState(presentationState, previousState, state);
    if (previousState.phase !== "GameOver") {
      elapsedGameplayMs += FRAME_MS;
    }
    uiAnimationFrames += 1;
    accumulator -= FRAME_MS;
  }

  render(presentationState.view);
  requestAnimationFrame(loop);
}

render(presentationState.view);
requestAnimationFrame(loop);
