import type { Field, GameState, Tetromino } from "../core/types.js";
import type {
  CellOffsetFloat,
  LineClearRowView,
  PresentationConfig,
  PresentationState,
  PresentationView,
  QueuePreviewItem,
  ShakeOffset,
} from "./types.js";

export const DEFAULT_PRESENTATION_CONFIG: PresentationConfig = {
  queueSlideFrames: 8,
  impactShakeFrames: 6,
  impactShakeAmplitude: 4,
  lineClearSlideDistanceCells: 12,
  activePieceMotionFrames: 4,
  entryMotionFrames: 6,
  entryMotionDistanceCells: 0.75,
};

const ZERO_CELL_OFFSET: CellOffsetFloat = { x: 0, y: 0 };

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildShakeOffset(
  framesRemaining: number,
  config: PresentationConfig,
): ShakeOffset {
  if (framesRemaining <= 0 || config.impactShakeFrames <= 0) {
    return { x: 0, y: 0 };
  }

  const intensity = framesRemaining / config.impactShakeFrames;
  const direction = framesRemaining % 2 === 0 ? -1 : 1;

  return {
    x: direction * config.impactShakeAmplitude * intensity,
    y: (direction * config.impactShakeAmplitude * 0.35) * intensity,
  };
}

function buildQueuePreviews(
  gameState: GameState,
  queueSlideFramesRemaining: number,
  config: PresentationConfig,
): QueuePreviewItem[] {
  const previews = gameState.queue.slice(0, gameState.config.previewCount);
  const slideFraction =
    config.queueSlideFrames > 0 ? queueSlideFramesRemaining / config.queueSlideFrames : 0;

  return previews.map((type, index) => ({
    type,
    index,
    yOffsetSlots: slideFraction,
  }));
}

function cloneField(field: Field): Field {
  return field.map((row) => [...row]);
}

function buildRenderedField(gameState: GameState): Field {
  if (gameState.phase !== "LineClear" || gameState.pendingClearedRows.length === 0) {
    return gameState.field;
  }

  const renderedField = cloneField(gameState.field);
  for (const rowIndex of gameState.pendingClearedRows) {
    renderedField[rowIndex].fill(null);
  }
  return renderedField;
}

function buildLineClearRows(
  gameState: GameState,
  config: PresentationConfig,
): LineClearRowView[] {
  if (gameState.phase !== "LineClear" || gameState.pendingClearedRows.length === 0) {
    return [];
  }

  const totalFrames = Math.max(1, gameState.config.timings.lineClearDelay);
  const elapsedFrames = totalFrames - gameState.lineClearFramesRemaining;
  const progress = Math.max(0, Math.min(1, elapsedFrames / totalFrames));
  const xOffsetCells = progress === 0 ? 0 : -config.lineClearSlideDistanceCells * progress;

  return gameState.pendingClearedRows.map((rowIndex) => ({
    y: rowIndex,
    xOffsetCells,
    cells: gameState.field[rowIndex]
      .map((cell, x) => (cell === null ? null : { x, type: cell }))
      .filter((cell): cell is { x: number; type: Tetromino } => cell !== null),
  }));
}

function buildActivePieceOffset(
  activePieceMotionOffset: CellOffsetFloat,
  activePieceMotionFramesRemaining: number,
  entryMotionFramesRemaining: number,
  config: PresentationConfig,
): CellOffsetFloat {
  const movementFactor =
    config.activePieceMotionFrames > 0
      ? activePieceMotionFramesRemaining / config.activePieceMotionFrames
      : 0;
  const entryFactor =
    config.entryMotionFrames > 0 ? entryMotionFramesRemaining / config.entryMotionFrames : 0;

  return {
    x: activePieceMotionOffset.x * movementFactor,
    y:
      activePieceMotionOffset.y * movementFactor -
      config.entryMotionDistanceCells * entryFactor,
  };
}

function buildView(
  gameState: GameState,
  queueSlideFramesRemaining: number,
  impactShakeFramesRemaining: number,
  activePieceMotionOffset: CellOffsetFloat,
  activePieceMotionFramesRemaining: number,
  entryMotionFramesRemaining: number,
  config: PresentationConfig,
): PresentationView {
  return {
    phase: gameState.phase,
    field: buildRenderedField(gameState),
    activePiece: gameState.activePiece,
    activePieceOffset: buildActivePieceOffset(
      activePieceMotionOffset,
      activePieceMotionFramesRemaining,
      entryMotionFramesRemaining,
      config,
    ),
    lineClearRows: buildLineClearRows(gameState, config),
    queuePreviews: buildQueuePreviews(gameState, queueSlideFramesRemaining, config),
    pieceCount: gameState.pieceCount,
    score: gameState.score,
    gravityInternal: gameState.gravityInternal,
    lockDelayRemaining: gameState.activePiece?.lockDelayRemaining ?? null,
    shakeOffset: buildShakeOffset(impactShakeFramesRemaining, config),
  };
}

export function createPresentationState(
  gameState: GameState,
  config: PresentationConfig = DEFAULT_PRESENTATION_CONFIG,
): PresentationState {
  return {
    config,
    queueSlideFramesRemaining: 0,
    impactShakeFramesRemaining: 0,
    activePieceMotionFramesRemaining: 0,
    entryMotionFramesRemaining: 0,
    hasTriggeredImpactShakeForCurrentPiece: false,
    activePieceMotionOffset: ZERO_CELL_OFFSET,
    view: buildView(gameState, 0, 0, ZERO_CELL_OFFSET, 0, 0, config),
  };
}

export function updatePresentationState(
  previousPresentationState: PresentationState,
  previousGameState: GameState,
  currentGameState: GameState,
): PresentationState {
  const previewCount = currentGameState.config.previewCount;
  const previousQueue = previousGameState.queue.slice(0, previewCount);
  const currentQueue = currentGameState.queue.slice(0, previewCount);
  const queueAdvanced = !arraysEqual(previousQueue, currentQueue);

  const queueSlideFramesRemaining = queueAdvanced
    ? previousPresentationState.config.queueSlideFrames
    : Math.max(0, previousPresentationState.queueSlideFramesRemaining - 1);

  const spawnedNewActivePiece =
    previousGameState.activePiece === null && currentGameState.activePiece !== null;
  const hasTriggeredImpactShakeForCurrentPiece = spawnedNewActivePiece
    ? false
    : previousPresentationState.hasTriggeredImpactShakeForCurrentPiece;

  const firstGroundContactTriggered =
    currentGameState.activePiece !== null &&
    currentGameState.activePiece.grounded &&
    !hasTriggeredImpactShakeForCurrentPiece &&
    (previousGameState.activePiece === null || !previousGameState.activePiece.grounded);

  const airborneLockTriggered =
    previousGameState.activePiece !== null &&
    !previousGameState.activePiece.grounded &&
    currentGameState.activePiece === null &&
    (currentGameState.phase === "ARE" || currentGameState.phase === "LineClear");

  const impactTriggered = firstGroundContactTriggered || airborneLockTriggered;

  const impactShakeFramesRemaining = impactTriggered
    ? previousPresentationState.config.impactShakeFrames
    : Math.max(0, previousPresentationState.impactShakeFramesRemaining - 1);

  const previousActivePiece = previousGameState.activePiece;
  const currentActivePiece = currentGameState.activePiece;
  const canInterpolateActivePiece =
    previousActivePiece !== null && currentActivePiece !== null;
  const activePieceMoved = canInterpolateActivePiece
    ? previousActivePiece.x !== currentActivePiece.x ||
      previousActivePiece.y !== currentActivePiece.y
    : false;

  const activePieceMotionOffset =
    spawnedNewActivePiece || currentActivePiece === null
      ? ZERO_CELL_OFFSET
      : activePieceMoved
        ? {
            x: previousActivePiece!.x - currentActivePiece.x,
            y: previousActivePiece!.y - currentActivePiece.y,
          }
        : previousPresentationState.activePieceMotionOffset;

  const activePieceMotionFramesRemaining =
    spawnedNewActivePiece || currentActivePiece === null
      ? 0
      : activePieceMoved
        ? previousPresentationState.config.activePieceMotionFrames
        : Math.max(0, previousPresentationState.activePieceMotionFramesRemaining - 1);

  const entryMotionFramesRemaining =
    currentActivePiece === null
      ? 0
      : spawnedNewActivePiece
        ? previousPresentationState.config.entryMotionFrames
        : Math.max(0, previousPresentationState.entryMotionFramesRemaining - 1);

  return {
    ...previousPresentationState,
    queueSlideFramesRemaining,
    impactShakeFramesRemaining,
    activePieceMotionFramesRemaining,
    entryMotionFramesRemaining,
    hasTriggeredImpactShakeForCurrentPiece:
      hasTriggeredImpactShakeForCurrentPiece || impactTriggered,
    activePieceMotionOffset,
    view: buildView(
      currentGameState,
      queueSlideFramesRemaining,
      impactShakeFramesRemaining,
      activePieceMotionOffset,
      activePieceMotionFramesRemaining,
      entryMotionFramesRemaining,
      previousPresentationState.config,
    ),
  };
}
