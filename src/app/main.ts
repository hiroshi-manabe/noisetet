import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  getCellsForPiece,
  REVEAL_ITEM_MAX_CHARGES,
  REVEAL_ITEM_PIECES_PER_CHARGE,
  stepGame,
  type InputFrame,
  type Tetromino,
} from "../core/index.js";
import {
  createGameAudio,
  detectAudioEvents,
} from "./audio.js";
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
  resolveBootSeed,
  type BootMode,
} from "./mode.js";
import {
  createPresentationState,
  triggerImpactShake,
  updatePresentationState,
  type PresentationState,
  type PresentationView,
} from "../presentation/index.js";

type PublicStartMode = "normal" | "gravity-max" | "easy";

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
const HUD_PANEL_HEIGHT = 280;
const SCORE_DISPLAY_DIGITS = 5;
const SCORE_DISPLAY_MAX = 99999;
const PIECES_DISPLAY_DIGITS = 3;
const PIECES_DISPLAY_MAX = 999;
const GAME_OVER_REVEAL_BLACK_COVERAGE = 0.4;
const REVEAL_GAUGE_WIDTH = 102;
const REVEAL_GAUGE_HEIGHT = 14;
const REVEAL_ITEM_TOKEN_SIZE = 14;
const REVEAL_ITEM_TOKEN_GAP = 8;
const EASY_PULSE_INTERVAL_MS = 2000;
const EASY_PULSE_DURATION_MS = 2000;
const EASY_PULSE_ATTACK_RATIO = 0.5;
const EASY_PULSE_BLACK_ALPHA = 0.10;

const pressedKeys = new Set<string>();

const shellElement = document.querySelector<HTMLElement>("#shell");
const sidebarElement = document.querySelector<HTMLElement>("#sidebar");
const canvasElement = document.querySelector<HTMLCanvasElement>("#game");
const startCardElement = document.querySelector<HTMLElement>("#start-card");
const statsElement = document.querySelector<HTMLDivElement>("#stats");
const statsCardElement = document.querySelector<HTMLElement>("#stats-card");
const themeToggleControlElement = document.querySelector<HTMLElement>("#theme-toggle-control");
const itemRevealControlElement = document.querySelector<HTMLElement>("#item-reveal-control");
const startModeToggleElement = document.querySelector<HTMLButtonElement>("#start-mode-toggle");
const soundToggleElement = document.querySelector<HTMLButtonElement>("#sound-toggle");
const autoShakeToggleElement = document.querySelector<HTMLButtonElement>("#auto-shake-toggle");
const revealAutoUseToggleElement = document.querySelector<HTMLButtonElement>("#reveal-auto-use-toggle");
const PUBLIC_START_MODE_STORAGE_KEY = "noisetet:public-start-mode";
const SOUND_ENABLED_STORAGE_KEY = "noisetet:sound-enabled";
const AUTO_SHAKE_ENABLED_STORAGE_KEY = "noisetet:auto-shake-enabled";
const REVEAL_AUTO_USE_ENABLED_STORAGE_KEY = "noisetet:reveal-auto-use-enabled";
const AUTO_SHAKE_INTERVAL_MS = 1000;

if (
  shellElement === null ||
  sidebarElement === null ||
  canvasElement === null ||
  startCardElement === null ||
  statsElement === null ||
  statsCardElement === null ||
  themeToggleControlElement === null ||
  itemRevealControlElement === null ||
  startModeToggleElement === null ||
  soundToggleElement === null ||
  autoShakeToggleElement === null ||
  revealAutoUseToggleElement === null
) {
  throw new Error("App root elements not found.");
}

const shell: HTMLElement = shellElement;
const sidebar: HTMLElement = sidebarElement;
const canvas: HTMLCanvasElement = canvasElement;
const startCard: HTMLElement = startCardElement;
const stats: HTMLDivElement = statsElement;
const statsCard: HTMLElement = statsCardElement;
const themeToggleControl: HTMLElement = themeToggleControlElement;
const itemRevealControl: HTMLElement = itemRevealControlElement;
const startModeToggle: HTMLButtonElement = startModeToggleElement;
const soundToggle: HTMLButtonElement = soundToggleElement;
const autoShakeToggle: HTMLButtonElement = autoShakeToggleElement;
const revealAutoUseToggle: HTMLButtonElement = revealAutoUseToggleElement;

const renderingContext = canvas.getContext("2d");
if (renderingContext === null) {
  throw new Error("Canvas 2D context is unavailable.");
}

const context: CanvasRenderingContext2D = renderingContext;
context.imageSmoothingEnabled = false;

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

function createRunStateForPublicStartMode(startMode: PublicStartMode): ReturnType<typeof createBootSession>["state"] {
  const seed = resolveBootSeed("normal");
  return createBootSession(startMode === "gravity-max" ? "debug20g" : "normal", seed).state;
}

function readPublicStartMode(): PublicStartMode {
  try {
    const stored = window.localStorage.getItem(PUBLIC_START_MODE_STORAGE_KEY);
    if (stored === "gravity-max" || stored === "easy" || stored === "normal") {
      return stored;
    }
  } catch {
    // Ignore storage failures and use the default mode.
  }

  return "normal";
}

function writePublicStartMode(mode: PublicStartMode): void {
  try {
    window.localStorage.setItem(PUBLIC_START_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures and keep the in-memory setting.
  }
}

const bootSession = createBootSession(readBootMode());
const debugMode = isDebugMode(bootSession.mode);
const initialPublicStartMode: PublicStartMode = debugMode ? "normal" : readPublicStartMode();
let themeName: AppTheme["name"] = readTheme();
let theme = createTheme(themeName, themeDimensions);
const audio = createGameAudio();
let soundEnabled = readSoundEnabled();
audio.setEnabled(soundEnabled);
let autoShakeEnabled = readAutoShakeEnabled();
let revealAutoUseEnabled = readRevealAutoUseEnabled();
let pendingAutoRevealUse = false;

let state = debugMode ? bootSession.state : createRunStateForPublicStartMode(initialPublicStartMode);
let presentationState: PresentationState = createPresentationState(state);
let isPaused = bootSession.paused;
let publicStartMode: PublicStartMode = initialPublicStartMode;
let activePublicRunMode: PublicStartMode = initialPublicStartMode;
let elapsedGameplayMs = 0;
let accumulator = 0;
let previousTime = performance.now();
let autoShakeElapsedMs = 0;
let easyPulseElapsedMs = 0;
let easyPulseRemainingMs = 0;

if (!debugMode) {
  statsCard.style.display = "none";
  themeToggleControl.style.display = "none";
  shell.style.width = "min(1040px, calc(100vw - 16px))";
} else {
  startCard.style.display = "none";
}

function applyTheme(nextThemeName: AppTheme["name"]): void {
  themeName = nextThemeName;
  theme = createTheme(themeName, themeDimensions);
}

function isStartModeSelectable(): boolean {
  return !debugMode;
}

function getNextPublicStartMode(mode: PublicStartMode): PublicStartMode {
  switch (mode) {
    case "normal":
      return "gravity-max";
    case "gravity-max":
      return "easy";
    case "easy":
    default:
      return "normal";
  }
}

function readSoundEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
    return stored === null ? true : stored !== "false";
  } catch {
    return true;
  }
}

function writeSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage failures and keep the in-memory setting.
  }
}

function renderSoundToggle(): void {
  soundToggle.innerHTML = `<strong>SOUND</strong> ${soundEnabled ? "ON" : "OFF"}`;
}

function readAutoShakeEnabled(): boolean {
  try {
    return window.localStorage.getItem(AUTO_SHAKE_ENABLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeAutoShakeEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(AUTO_SHAKE_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage failures and keep the in-memory setting.
  }
}

function renderAutoShakeToggle(): void {
  autoShakeToggle.innerHTML = `<strong>AUTO SHAKE</strong> ${autoShakeEnabled ? "ON" : "OFF"}`;
}

function renderStartModeToggle(): void {
  const label =
    publicStartMode === "gravity-max" ? "MAX" : publicStartMode === "easy" ? "EASY" : "NORMAL";
  startModeToggle.innerHTML = `<strong>MODE</strong> ${label}`;
  startModeToggle.disabled = !isStartModeSelectable();
}

function readRevealAutoUseEnabled(): boolean {
  try {
    return window.localStorage.getItem(REVEAL_AUTO_USE_ENABLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeRevealAutoUseEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(REVEAL_AUTO_USE_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage failures and keep the in-memory setting.
  }
}

function buildRevealItems(charges: number): string {
  const clampedCharges = Math.max(0, Math.min(REVEAL_ITEM_MAX_CHARGES, Math.floor(charges)));
  return clampedCharges === 0 ? "-" : "■".repeat(clampedCharges);
}

function renderRevealControls(): void {
  revealAutoUseToggle.innerHTML = `<strong>AUTO USE</strong> ${revealAutoUseEnabled ? "ON" : "OFF"}`;
}

window.addEventListener("keydown", (event) => {
  audio.unlock();

  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX", "KeyC", "KeyD", "KeyP", "KeyS", "KeyV"].includes(
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

  if (event.code === "KeyS" && !event.repeat && !isPaused && state.phase !== "GameOver") {
    presentationState = triggerImpactShake(presentationState, state);
    audio.playImpact();
    return;
  }

  if (state.phase === "GameOver" && event.code === "KeyR") {
    activePublicRunMode = publicStartMode;
    state = debugMode
      ? createBootSession(bootSession.mode).state
      : createRunStateForPublicStartMode(publicStartMode);
    presentationState = createPresentationState(state);
    isPaused = false;
    elapsedGameplayMs = 0;
    accumulator = 0;
    autoShakeElapsedMs = 0;
    easyPulseElapsedMs = 0;
    easyPulseRemainingMs = 0;
    pendingAutoRevealUse = revealAutoUseEnabled && state.revealCharges > 0;
    pressedKeys.clear();
  }
});

window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
});

window.addEventListener("pointerdown", () => {
  audio.unlock();
});

startModeToggle.addEventListener("click", () => {
  if (!isStartModeSelectable()) {
    return;
  }

  publicStartMode = getNextPublicStartMode(publicStartMode);
  writePublicStartMode(publicStartMode);
  renderStartModeToggle();
});

soundToggle.addEventListener("click", () => {
  audio.unlock();
  soundEnabled = !soundEnabled;
  audio.setEnabled(soundEnabled);
  writeSoundEnabled(soundEnabled);
  renderSoundToggle();
});

autoShakeToggle.addEventListener("click", () => {
  autoShakeEnabled = !autoShakeEnabled;
  autoShakeElapsedMs = 0;
  writeAutoShakeEnabled(autoShakeEnabled);
  renderAutoShakeToggle();
});

revealAutoUseToggle.addEventListener("click", () => {
  revealAutoUseEnabled = !revealAutoUseEnabled;
  writeRevealAutoUseEnabled(revealAutoUseEnabled);
  if (revealAutoUseEnabled && state.revealCharges > 0 && state.phase !== "GameOver") {
    pendingAutoRevealUse = true;
  }
  renderRevealControls();
});

function buildInputFrame(autoShakePulse: boolean, autoRevealUsePulse: boolean): InputFrame {
  return {
    left: pressedKeys.has("ArrowLeft"),
    right: pressedKeys.has("ArrowRight"),
    rotateCW: pressedKeys.has("KeyX"),
    rotateCCW: pressedKeys.has("KeyZ") || pressedKeys.has("KeyC"),
    up: pressedKeys.has("ArrowUp"),
    down: pressedKeys.has("ArrowDown"),
    shake: pressedKeys.has("KeyS") || autoShakePulse,
    reveal: pressedKeys.has("KeyD") || autoRevealUsePulse,
  };
}

function getRevealOverlayAlpha(view: PresentationView): number {
  if (view.revealPulseStrength <= 0) {
    return 0;
  }

  const easedStrength = Math.pow(view.revealPulseStrength, 0.75);
  return (theme.name === "noise" ? 0.78 : 0.28) * easedStrength;
}

function drawRevealOverlayRect(x: number, y: number, width: number, height: number, alpha: number): void {
  if (alpha <= 0) {
    return;
  }

  context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function getEasyModeOverlayAlpha(): number {
  if (debugMode || activePublicRunMode !== "easy" || easyPulseRemainingMs <= 0) {
    return 0;
  }

  const elapsed = EASY_PULSE_DURATION_MS - easyPulseRemainingMs;
  const progress = Math.max(0, Math.min(1, elapsed / EASY_PULSE_DURATION_MS));
  const attackProgress = Math.max(0.001, Math.min(0.999, EASY_PULSE_ATTACK_RATIO));

  let envelope = 0;
  if (progress <= attackProgress) {
    envelope = progress / attackProgress;
  } else {
    envelope = 1 - (progress - attackProgress) / (1 - attackProgress);
  }

  const easedEnvelope = Math.sin(Math.max(0, Math.min(1, envelope)) * (Math.PI / 2));
  return EASY_PULSE_BLACK_ALPHA * easedEnvelope;
}

function getTransientDarkOverlayAlpha(view: PresentationView): number {
  return Math.max(getRevealOverlayAlpha(view), getEasyModeOverlayAlpha());
}

function hashToUnit(seed: number, x: number, y: number): number {
  let hash = seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

function drawGameOverRevealDots(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  progress: number,
): void {
  const clampedCoverage =
    Math.max(0, Math.min(1, progress)) * GAME_OVER_REVEAL_BLACK_COVERAGE;
  if (clampedCoverage <= 0) {
    return;
  }

  const startX = Math.round(x);
  const startY = Math.round(y);
  const endX = startX + Math.round(width);
  const endY = startY + Math.round(height);

  context.fillStyle = "#000";
  for (let drawY = startY; drawY < endY; drawY += 1) {
    for (let drawX = startX; drawX < endX; drawX += 1) {
      if (hashToUnit(seed, drawX - startX, drawY - startY) <= clampedCoverage) {
        context.fillRect(drawX, drawY, 1, 1);
      }
    }
  }
}

function shouldRevealGameOver(view: PresentationView): boolean {
  return theme.name === "noise" && view.phase === "GameOver" && view.gameOverRevealProgress > 0;
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
  const transientDarkAlpha = getTransientDarkOverlayAlpha(view);
  context.drawImage(theme.frameSurface, originX, originY);

  if (transientDarkAlpha > 0) {
    drawRevealOverlayRect(originX, originY, FRAME_OUTER_WIDTH, FRAME_THICKNESS, transientDarkAlpha);
    drawRevealOverlayRect(
      originX,
      originY + FRAME_OUTER_HEIGHT - FRAME_THICKNESS,
      FRAME_OUTER_WIDTH,
      FRAME_THICKNESS,
      transientDarkAlpha,
    );
    drawRevealOverlayRect(originX, originY + FRAME_THICKNESS, FRAME_THICKNESS, BOARD_HEIGHT, transientDarkAlpha);
    drawRevealOverlayRect(
      originX + FRAME_OUTER_WIDTH - FRAME_THICKNESS,
      originY + FRAME_THICKNESS,
      FRAME_THICKNESS,
      BOARD_HEIGHT,
      transientDarkAlpha,
    );
  }

  if (!shouldRevealGameOver(view)) {
    return;
  }

  drawGameOverRevealDots(originX, originY, FRAME_OUTER_WIDTH, FRAME_THICKNESS, 101, view.gameOverRevealProgress);
  drawGameOverRevealDots(
    originX,
    originY + FRAME_OUTER_HEIGHT - FRAME_THICKNESS,
    FRAME_OUTER_WIDTH,
    FRAME_THICKNESS,
    102,
    view.gameOverRevealProgress,
  );
  drawGameOverRevealDots(originX, originY + FRAME_THICKNESS, FRAME_THICKNESS, BOARD_HEIGHT, 103, view.gameOverRevealProgress);
  drawGameOverRevealDots(
    originX + FRAME_OUTER_WIDTH - FRAME_THICKNESS,
    originY + FRAME_THICKNESS,
    FRAME_THICKNESS,
    BOARD_HEIGHT,
    104,
    view.gameOverRevealProgress,
  );
}

function drawField(view: PresentationView): void {
  const originX = BOARD_X + view.shakeOffset.x;
  const originY = BOARD_Y + view.shakeOffset.y;
  const revealGameOver = shouldRevealGameOver(view);
  const transientDarkAlpha = getTransientDarkOverlayAlpha(view);

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

      if (revealGameOver) {
        drawGameOverRevealDots(
          originX + x * CELL_SIZE,
          originY + (y - 1) * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE,
          2000 + y * FIELD_WIDTH + x,
          view.gameOverRevealProgress,
        );
      }

      if (transientDarkAlpha > 0) {
        drawRevealOverlayRect(
          originX + x * CELL_SIZE,
          originY + (y - 1) * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE,
          transientDarkAlpha,
        );
      }
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
  const revealGameOver = shouldRevealGameOver(view);
  const transientDarkAlpha = getTransientDarkOverlayAlpha(view);

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

    if (revealGameOver) {
      drawGameOverRevealDots(
        originX + (activePiece.x + cell.x + view.activePieceOffset.x) * CELL_SIZE,
        originY + (y - 1 + view.activePieceOffset.y) * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE,
        3000 + y * FIELD_WIDTH + activePiece.x + cell.x,
        view.gameOverRevealProgress,
      );
    }

    if (transientDarkAlpha > 0) {
      drawRevealOverlayRect(
        originX + (activePiece.x + cell.x + view.activePieceOffset.x) * CELL_SIZE,
        originY + (y - 1 + view.activePieceOffset.y) * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE,
        transientDarkAlpha,
      );
    }
  }
}

function drawLineClearRows(view: PresentationView): void {
  if (view.lineClearRows.length === 0) {
    return;
  }

  const originX = BOARD_X + view.shakeOffset.x;
  const originY = BOARD_Y + view.shakeOffset.y;
  const transientDarkAlpha = getTransientDarkOverlayAlpha(view);

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

      if (transientDarkAlpha > 0) {
        drawRevealOverlayRect(
          originX + (cell.x + row.xOffsetCells) * CELL_SIZE,
          originY + (row.y - 1) * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE,
          transientDarkAlpha,
        );
      }
    }
  }
}

function drawPreviewPiece(type: Tetromino, x: number, y: number, previewIndex: number, view: PresentationView): void {
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
  const transientDarkAlpha = getTransientDarkOverlayAlpha(view);
  const revealGameOver = shouldRevealGameOver(view);

  for (const cell of cells) {
    drawMaterialCell(
      offsetX + cell.x * CELL_SIZE,
      offsetY + cell.y * CELL_SIZE,
      theme.pieceMaterials[type],
      0,
      cell.x,
      cell.y,
    );

    if (transientDarkAlpha > 0) {
      drawRevealOverlayRect(
        offsetX + cell.x * CELL_SIZE,
        offsetY + cell.y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE,
        transientDarkAlpha,
      );
    }

    if (revealGameOver) {
      drawGameOverRevealDots(
        offsetX + cell.x * CELL_SIZE,
        offsetY + cell.y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE,
        4000 + previewIndex * 16 + cell.y * 4 + cell.x,
        view.gameOverRevealProgress,
      );
    }
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
    const pieceX = boxX + view.shakeOffset.x;
    const pieceY = boxY + view.shakeOffset.y;

    if (theme.showPreviewBoxChrome) {
      context.drawImage(theme.previewBoxSurface, boxX, boxY);
      context.strokeStyle = theme.previewBoxStroke;
      context.strokeRect(boxX + 0.5, boxY + 0.5, PREVIEW_BOX - 1, PREVIEW_BOX - 1);
    }
    drawPreviewPiece(preview.type, pieceX, pieceY, preview.index, view);
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

function drawCenteredLabel(texture: HTMLCanvasElement, centerX: number, y: number): void {
  context.drawImage(texture, Math.round(centerX - texture.width / 2), y);
}

function drawRevealGauge(view: PresentationView, x: number, y: number): void {
  const startX = Math.round(x + (HUD_PANEL_WIDTH - 16 - REVEAL_GAUGE_WIDTH) / 2);
  const progress = Math.max(0, Math.min(REVEAL_ITEM_PIECES_PER_CHARGE, view.revealChargeProgress));
  const fillWidth = Math.round((progress / REVEAL_ITEM_PIECES_PER_CHARGE) * (REVEAL_GAUGE_WIDTH - 4));

  context.strokeStyle = theme.name === "noise" ? "rgba(238, 241, 223, 0.9)" : "rgba(73, 82, 59, 0.95)";
  context.lineWidth = 1;
  context.strokeRect(startX + 0.5, y + 0.5, REVEAL_GAUGE_WIDTH - 1, REVEAL_GAUGE_HEIGHT - 1);

  context.fillStyle = theme.name === "noise" ? "rgba(238, 241, 223, 0.22)" : "rgba(73, 82, 59, 0.22)";
  context.fillRect(startX + 2, y + 2, REVEAL_GAUGE_WIDTH - 4, REVEAL_GAUGE_HEIGHT - 4);

  if (fillWidth > 0) {
    context.fillStyle = "#ffffff";
    context.fillRect(startX + 2, y + 2, fillWidth, REVEAL_GAUGE_HEIGHT - 4);
  }
}

function drawRevealItems(view: PresentationView, x: number, y: number): void {
  if (view.revealCharges <= 0) {
    context.fillStyle = "#ffffff";
    context.font = 'bold 16px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("-", x + HUD_PANEL_WIDTH / 2 - 8, y + REVEAL_ITEM_TOKEN_SIZE / 2);
    return;
  }

  const totalWidth =
    view.revealCharges * REVEAL_ITEM_TOKEN_SIZE +
    Math.max(0, view.revealCharges - 1) * REVEAL_ITEM_TOKEN_GAP;
  let tokenX = Math.round(x + (HUD_PANEL_WIDTH - 16 - totalWidth) / 2);

  for (let index = 0; index < view.revealCharges; index += 1) {
    context.strokeStyle = theme.name === "noise" ? "rgba(238, 241, 223, 0.8)" : "rgba(73, 82, 59, 0.95)";
    context.lineWidth = 1;
    context.strokeRect(tokenX + 0.5, y + 0.5, REVEAL_ITEM_TOKEN_SIZE - 1, REVEAL_ITEM_TOKEN_SIZE - 1);
    context.fillStyle = "#ffffff";
    context.fillRect(tokenX + 2, y + 2, REVEAL_ITEM_TOKEN_SIZE - 4, REVEAL_ITEM_TOKEN_SIZE - 4);
    tokenX += REVEAL_ITEM_TOKEN_SIZE + REVEAL_ITEM_TOKEN_GAP;
  }
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

  drawHudLabel(theme.hudTextures.labels.reveal, labelX, HUD_PANEL_Y + 188);
  drawRevealGauge(view, HUD_PANEL_X + 8, HUD_PANEL_Y + 226);
  drawRevealItems(view, HUD_PANEL_X + 8, HUD_PANEL_Y + 248);
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
    ["StartMode", debugMode ? bootSession.mode : publicStartMode],
    ["Gravity", String(view.gravityInternal)],
    ["RevealAuto", revealAutoUseEnabled ? "on" : "off"],
    ["RevealGauge", `${view.revealChargeProgress}/${REVEAL_ITEM_PIECES_PER_CHARGE}`],
    ["RevealItems", buildRevealItems(view.revealCharges)],
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
    const overlayY = BOARD_Y + 160;
    const overlayHeight = 128;
    const overlayCenterX = BOARD_X + BOARD_WIDTH / 2;

    context.fillStyle = theme.overlayFill;
    context.fillRect(BOARD_X, overlayY, BOARD_WIDTH, overlayHeight);
    drawCenteredLabel(theme.hudTextures.overlayLabels.gameOver, overlayCenterX, overlayY + 12);
    drawCenteredLabel(theme.hudTextures.overlayLabels.pressR, overlayCenterX, overlayY + 46);
    drawCenteredLabel(theme.hudTextures.overlayLabels.toRestart, overlayCenterX, overlayY + 80);
  }

  if (isPaused) {
    const overlayY = BOARD_Y + 160;
    const overlayHeight = 128;
    const overlayCenterX = BOARD_X + BOARD_WIDTH / 2;

    context.fillStyle = theme.overlayFill;
    context.fillRect(BOARD_X, overlayY, BOARD_WIDTH, overlayHeight);
    drawCenteredLabel(theme.hudTextures.overlayLabels.paused, overlayCenterX, overlayY + 12);
    drawCenteredLabel(theme.hudTextures.overlayLabels.pressP, overlayCenterX, overlayY + 46);
    drawCenteredLabel(theme.hudTextures.overlayLabels.toResume, overlayCenterX, overlayY + 80);
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
    let autoShakePulse = false;
    let autoRevealUsePulse = false;
    if (autoShakeEnabled && state.phase !== "GameOver") {
      autoShakeElapsedMs += FRAME_MS;
      if (autoShakeElapsedMs >= AUTO_SHAKE_INTERVAL_MS) {
        autoShakeElapsedMs -= AUTO_SHAKE_INTERVAL_MS;
        autoShakePulse = true;
        presentationState = triggerImpactShake(presentationState, state);
        audio.playImpact();
      }
    }

    if (!debugMode && activePublicRunMode === "easy" && state.phase !== "GameOver") {
      easyPulseElapsedMs += FRAME_MS;
      easyPulseRemainingMs = Math.max(0, easyPulseRemainingMs - FRAME_MS);
      if (easyPulseElapsedMs >= EASY_PULSE_INTERVAL_MS) {
        easyPulseElapsedMs -= EASY_PULSE_INTERVAL_MS;
        easyPulseRemainingMs = EASY_PULSE_DURATION_MS;
      }
    } else {
      easyPulseElapsedMs = 0;
      easyPulseRemainingMs = 0;
    }

    if (pendingAutoRevealUse && state.phase !== "GameOver") {
      autoRevealUsePulse = true;
      pendingAutoRevealUse = false;
    }

    state = stepGame(state, buildInputFrame(autoShakePulse, autoRevealUsePulse));
    presentationState = updatePresentationState(presentationState, previousState, state);
    if (revealAutoUseEnabled && state.revealCharges > previousState.revealCharges && state.phase !== "GameOver") {
      pendingAutoRevealUse = true;
    }
    renderRevealControls();
    const audioEvents = detectAudioEvents(previousState, state);
    if (audioEvents.playImpact) {
      audio.playImpact();
    }
    if (audioEvents.playLineClear) {
      audio.playLineClear();
    }
    if (previousState.phase !== "GameOver") {
      elapsedGameplayMs += FRAME_MS;
    }
    accumulator -= FRAME_MS;
  }

  renderStartModeToggle();
  render(presentationState.view);
  requestAnimationFrame(loop);
}

renderStartModeToggle();
renderSoundToggle();
renderAutoShakeToggle();
renderRevealControls();
render(presentationState.view);
requestAnimationFrame(loop);
