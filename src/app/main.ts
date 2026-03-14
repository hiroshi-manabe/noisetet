import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  getCellsForPiece,
  stepGame,
  type InputFrame,
  type Tetromino,
} from "../core/index.js";
import {
  createTheme,
  getNextTheme,
  resolveRuntimeTheme,
  rotationToQuarterTurns,
  THEME_ENV_KEY,
  THEME_STORAGE_KEY,
  type AppTheme,
  type ThemeDimensions,
  type TileMaterial,
} from "./theme.js";
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
const CELL_SIZE = 30;
const BOARD_X = 36;
const BOARD_Y = 30;
const BOARD_WIDTH = FIELD_WIDTH * CELL_SIZE;
const BOARD_HEIGHT = VISIBLE_ROWS * CELL_SIZE;
const FRAME_THICKNESS = CELL_SIZE;
const FRAME_X = BOARD_X - FRAME_THICKNESS;
const FRAME_Y = BOARD_Y - FRAME_THICKNESS;
const FRAME_OUTER_WIDTH = BOARD_WIDTH + FRAME_THICKNESS * 2;
const FRAME_OUTER_HEIGHT = BOARD_HEIGHT + FRAME_THICKNESS * 2;
const PREVIEW_BOX = 96;
const FRAME_MS = 1000 / 60;
const PREVIEW_PANEL_WIDTH = 128;
const PREVIEW_PANEL_HEIGHT = 358;
const SIDE_PANEL_X = FRAME_X + FRAME_OUTER_WIDTH + 16;
const HUD_PANEL_X = SIDE_PANEL_X;
const HUD_PANEL_Y = BOARD_Y + PREVIEW_PANEL_HEIGHT + 12;
const HUD_PANEL_WIDTH = PREVIEW_PANEL_WIDTH;
const HUD_PANEL_HEIGHT = 212;
const SCORE_DISPLAY_DIGITS = 5;
const SCORE_DISPLAY_MAX = 99999;
const PIECES_DISPLAY_DIGITS = 3;
const PIECES_DISPLAY_MAX = 999;

const pressedKeys = new Set<string>();

const shellElement = document.querySelector<HTMLElement>("#shell");
const sidebarElement = document.querySelector<HTMLElement>("#sidebar");
const canvasElement = document.querySelector<HTMLCanvasElement>("#game");
const statsElement = document.querySelector<HTMLDivElement>("#stats");

if (
  shellElement === null ||
  sidebarElement === null ||
  canvasElement === null ||
  statsElement === null
) {
  throw new Error("App root elements not found.");
}

const shell: HTMLElement = shellElement;
const sidebar: HTMLElement = sidebarElement;
const canvas: HTMLCanvasElement = canvasElement;
const stats: HTMLDivElement = statsElement;

const renderingContext = canvas.getContext("2d");
if (renderingContext === null) {
  throw new Error("Canvas 2D context is unavailable.");
}

const context: CanvasRenderingContext2D = renderingContext;

const themeDimensions: ThemeDimensions = {
  canvasWidth: canvas.width,
  canvasHeight: canvas.height,
  boardWidth: BOARD_WIDTH,
  boardHeight: BOARD_HEIGHT,
  frameOuterWidth: FRAME_OUTER_WIDTH,
  frameOuterHeight: FRAME_OUTER_HEIGHT,
  previewPanelWidth: PREVIEW_PANEL_WIDTH,
  previewPanelHeight: PREVIEW_PANEL_HEIGHT,
  previewBoxSize: PREVIEW_BOX,
  hudPanelWidth: HUD_PANEL_WIDTH,
  hudPanelHeight: HUD_PANEL_HEIGHT,
  frameThickness: FRAME_THICKNESS,
};

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

function readTheme(): AppTheme["name"] {
  try {
    return resolveRuntimeTheme(
      bootSession.mode,
      import.meta.env[THEME_ENV_KEY],
      window.localStorage.getItem(THEME_STORAGE_KEY),
    );
  } catch {
    return "solid";
  }
}

const bootSession = createBootSession(readBootMode());
const debugMode = isDebugMode(bootSession.mode);
let themeName: AppTheme["name"] = readTheme();
let theme = createTheme(themeName, themeDimensions);

let state = bootSession.state;
let presentationState: PresentationState = createPresentationState(state);
let isPaused = bootSession.paused;
let elapsedGameplayMs = 0;
let accumulator = 0;
let previousTime = performance.now();

if (!debugMode) {
  sidebar.style.display = "none";
  shell.style.gridTemplateColumns = "1fr";
  shell.style.width = "min(552px, calc(100vw - 16px))";
}

function applyTheme(nextThemeName: AppTheme["name"]): void {
  themeName = nextThemeName;
  theme = createTheme(themeName, themeDimensions);
}

window.addEventListener("keydown", (event) => {
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX", "KeyC", "KeyP", "KeyV"].includes(
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

  if (debugMode && event.code === "KeyV" && !event.repeat) {
    applyTheme(getNextTheme(themeName));
    return;
  }

  if (state.phase === "GameOver" && event.code === "KeyR") {
    state = createBootSession(bootSession.mode).state;
    presentationState = createPresentationState(state);
    isPaused = false;
    elapsedGameplayMs = 0;
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

function drawMaterialCell(
  x: number,
  y: number,
  material: TileMaterial,
  quarterTurns: number,
  sourceCellX: number,
  sourceCellY: number,
): void {
  const normalizedQuarterTurns = ((quarterTurns % 4) + 4) % 4;
  const sourceTexture = material.textures[material.rotateWithPiece ? normalizedQuarterTurns : 0];

  context.drawImage(
    sourceTexture,
    sourceCellX * CELL_SIZE,
    sourceCellY * CELL_SIZE,
    CELL_SIZE,
    CELL_SIZE,
    x,
    y,
    CELL_SIZE,
    CELL_SIZE,
  );
}

function drawBoardGrid(): void {
  const originX = BOARD_X;
  const originY = BOARD_Y;

  context.drawImage(theme.boardSurfaceTexture, originX, originY);

  context.strokeStyle = theme.gridStroke;
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

function drawFrame(view: PresentationView): void {
  const originX = FRAME_X + view.shakeOffset.x;
  const originY = FRAME_Y + view.shakeOffset.y;
  context.drawImage(theme.frameSurface, originX, originY);
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

      drawMaterialCell(
        originX + x * CELL_SIZE,
        originY + (y - 1) * CELL_SIZE,
        theme.pieceMaterials[cell.type],
        cell.quarterTurns,
        cell.sourceCellX,
        cell.sourceCellY,
      );
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
  const quarterTurns = rotationToQuarterTurns(activePiece.rotation);

  for (const cell of getCellsForPiece(activePiece)) {
    const y = activePiece.y + cell.y;
    if (y < 1) {
      continue;
    }

    drawMaterialCell(
      originX + (activePiece.x + cell.x + view.activePieceOffset.x) * CELL_SIZE,
      originY + (y - 1 + view.activePieceOffset.y) * CELL_SIZE,
      theme.pieceMaterials[activePiece.type],
      quarterTurns,
      cell.x,
      cell.y,
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
      drawMaterialCell(
        originX + (cell.x + row.xOffsetCells) * CELL_SIZE,
        originY + (row.y - 1) * CELL_SIZE,
        theme.pieceMaterials[cell.type],
        cell.quarterTurns,
        cell.sourceCellX,
        cell.sourceCellY,
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
    drawMaterialCell(
      offsetX + cell.x * CELL_SIZE,
      offsetY + cell.y * CELL_SIZE,
      theme.pieceMaterials[type],
      0,
      cell.x,
      cell.y,
    );
  }
}

function drawPreviews(view: PresentationView): void {
  if (theme.showPreviewPanelChrome) {
    context.drawImage(theme.previewPanelSurface, SIDE_PANEL_X, BOARD_Y);
    context.strokeStyle = theme.panelStroke;
    context.lineWidth = 2;
    context.strokeRect(
      SIDE_PANEL_X + 0.5,
      BOARD_Y + 0.5,
      PREVIEW_PANEL_WIDTH - 1,
      PREVIEW_PANEL_HEIGHT - 1,
    );
  }

  if (theme.showNextLabel) {
    context.fillStyle = theme.nextLabelColor;
    context.font = '12px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("NEXT", SIDE_PANEL_X + 16, BOARD_Y + 20);
  }

  view.queuePreviews.forEach((preview) => {
    const boxX = SIDE_PANEL_X + 16;
    const boxY = BOARD_Y + 34 + (preview.index + preview.yOffsetSlots) * 108;

    if (theme.showPreviewBoxChrome) {
      context.drawImage(theme.previewBoxSurface, boxX, boxY);
      context.strokeStyle = theme.previewBoxStroke;
      context.strokeRect(boxX + 0.5, boxY + 0.5, PREVIEW_BOX - 1, PREVIEW_BOX - 1);
    }
    drawPreviewPiece(preview.type, boxX, boxY);
  });
}

function drawTexturedNumber(value: number, x: number, y: number, slots: number, maxValue: number): void {
  const clampedValue = Math.min(maxValue, Math.max(0, Math.floor(value)));
  const digits = String(clampedValue);
  const slotWidth = theme.hudTextures.digitWidth;
  const totalWidth = slots * slotWidth;
  let cursorX = x + totalWidth - digits.length * slotWidth;

  for (const digit of digits) {
    const texture = theme.hudTextures.digits[digit];
    context.drawImage(texture, cursorX, y, theme.hudTextures.digitWidth, theme.hudTextures.digitHeight);
    cursorX += slotWidth;
  }
}

function drawHudLabel(texture: HTMLCanvasElement, x: number, y: number): void {
  context.drawImage(texture, x, y);
}

function drawUserHud(view: PresentationView): void {
  if (theme.showHudPanelChrome) {
    context.drawImage(theme.hudPanelSurface, HUD_PANEL_X, HUD_PANEL_Y);
    context.strokeStyle = theme.panelStroke;
    context.lineWidth = 2;
    context.strokeRect(HUD_PANEL_X + 0.5, HUD_PANEL_Y + 0.5, HUD_PANEL_WIDTH - 1, HUD_PANEL_HEIGHT - 1);
  }

  const labelX = HUD_PANEL_X + 8;
  const digitsX = HUD_PANEL_X + 8;

  drawHudLabel(theme.hudTextures.labels.score, labelX, HUD_PANEL_Y + 12);
  drawTexturedNumber(view.score, digitsX, HUD_PANEL_Y + 48, SCORE_DISPLAY_DIGITS, SCORE_DISPLAY_MAX);

  drawHudLabel(theme.hudTextures.labels.pieces, labelX, HUD_PANEL_Y + 104);
  drawTexturedNumber(
    view.pieceCount,
    digitsX + (SCORE_DISPLAY_DIGITS - PIECES_DISPLAY_DIGITS) * theme.hudTextures.digitWidth,
    HUD_PANEL_Y + 140,
    PIECES_DISPLAY_DIGITS,
    PIECES_DISPLAY_MAX,
  );
}

function renderStats(view: PresentationView, paused: boolean, elapsedMs: number): void {
  stats.innerHTML = [
    ["Mode", bootSession.mode],
    ["Theme", theme.name],
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
  context.drawImage(theme.backgroundTexture, 0, 0);

  drawBoardGrid();
  drawFrame(view);
  drawField(view);
  drawActivePiece(view);
  drawLineClearRows(view);
  drawPreviews(view);
  drawUserHud(view);

  if (view.phase === "GameOver") {
    context.fillStyle = theme.overlayFill;
    context.fillRect(BOARD_X, BOARD_Y + 180, BOARD_WIDTH, 96);
    context.fillStyle = theme.overlayText;
    context.font = '18px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("GAME OVER", BOARD_X + 110, BOARD_Y + 218);
    context.fillStyle = theme.overlayMuted;
    context.font = '12px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("Press R to restart", BOARD_X + 104, BOARD_Y + 244);
  }

  if (isPaused) {
    context.fillStyle = theme.overlayFill;
    context.fillRect(BOARD_X, BOARD_Y + 180, BOARD_WIDTH, 96);
    context.fillStyle = theme.overlayText;
    context.font = '18px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.fillText("PAUSED", BOARD_X + 132, BOARD_Y + 218);
    context.fillStyle = theme.overlayMuted;
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
    accumulator -= FRAME_MS;
  }

  render(presentationState.view);
  requestAnimationFrame(loop);
}

render(presentationState.view);
requestAnimationFrame(loop);
