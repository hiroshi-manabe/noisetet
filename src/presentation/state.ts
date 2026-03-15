import type { Field, GameState, Rotation, Tetromino } from "../core/types.js";
import { getCellsForPiece } from "../core/index.js";
import type {
  CellOffsetFloat,
  LineClearRowView,
  PresentationConfig,
  SettledCellView,
  SettledFieldView,
  PresentationState,
  PresentationView,
  QueuePreviewItem,
  ShakeOffset,
} from "./types.js";

export const DEFAULT_PRESENTATION_CONFIG: PresentationConfig = {
  queueSlideFrames: 8,
  impactShakeFrames: 8,
  impactShakeAmplitude: 8,
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

  const totalFrames = config.impactShakeFrames;
  const elapsedFrames = totalFrames - framesRemaining;
  const downwardFrames = Math.max(1, Math.ceil(totalFrames / 2));
  const upwardFrames = Math.max(1, totalFrames - downwardFrames);

  let y = 0;
  if (elapsedFrames < downwardFrames) {
    const phase = elapsedFrames / downwardFrames;
    y = config.impactShakeAmplitude * (1 - phase);
  } else {
    const upwardElapsed = elapsedFrames - downwardFrames;
    const phase = upwardFrames <= 1 ? 1 : upwardElapsed / (upwardFrames - 1);
    y = -config.impactShakeAmplitude * 0.45 * (1 - phase);
  }

  return {
    x: 0,
    y,
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

function cloneSettledField(field: SettledFieldView): SettledFieldView {
  return field.map((row) => row.map((cell) => (cell === null ? null : { ...cell })));
}

function rotationToQuarterTurns(rotation: Rotation): number {
  switch (rotation) {
    case "right":
      return 1;
    case "reverse":
      return 2;
    case "left":
      return 3;
    case "spawn":
    default:
      return 0;
  }
}

function buildInitialSettledField(field: Field): SettledFieldView {
  return field.map((row) =>
    row.map((cell) =>
      cell === null
        ? null
        : { type: cell, quarterTurns: 0, sourceCellX: 0, sourceCellY: 0 },
    ),
  );
}

function collapseSettledField(field: SettledFieldView, clearedRows: number[]): SettledFieldView {
  if (clearedRows.length === 0) {
    return cloneSettledField(field);
  }

  const remainingRows = field.filter((_, index) => !clearedRows.includes(index));
  const emptyRows = Array.from({ length: clearedRows.length }, () =>
    Array<SettledCellView | null>(field[0]?.length ?? 0).fill(null),
  );

  return [...emptyRows, ...remainingRows.map((row) => row.map((cell) => (cell === null ? null : { ...cell })))];
}

function mergeLockedPieceIntoSettledField(
  field: SettledFieldView,
  gameState: GameState,
  lockedPiece: NonNullable<GameState["activePiece"]>,
): SettledFieldView {
  const nextField = cloneSettledField(field);
  const quarterTurns = lockedPiece.type === "O" ? 0 : rotationToQuarterTurns(lockedPiece.rotation);
  const lockedCells = getCellsForPiece(lockedPiece);
  const newAbsoluteCells: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < gameState.field.length; y += 1) {
    for (let x = 0; x < gameState.field[y].length; x += 1) {
      if (field[y][x] !== null || gameState.field[y][x] !== lockedPiece.type) {
        continue;
      }
      newAbsoluteCells.push({ x, y });
    }
  }

  let inferredOrigin: { x: number; y: number } | null = null;
  const absoluteCellSet = new Set(newAbsoluteCells.map((cell) => `${cell.x},${cell.y}`));

  for (const absoluteCell of newAbsoluteCells) {
    for (const localCell of lockedCells) {
      const candidateOrigin = {
        x: absoluteCell.x - localCell.x,
        y: absoluteCell.y - localCell.y,
      };
      const matches = lockedCells.every((candidateCell) =>
        absoluteCellSet.has(
          `${candidateOrigin.x + candidateCell.x},${candidateOrigin.y + candidateCell.y}`,
        ),
      );

      if (matches) {
        inferredOrigin = candidateOrigin;
        break;
      }
    }

    if (inferredOrigin !== null) {
      break;
    }
  }

  if (inferredOrigin === null) {
    inferredOrigin = { x: lockedPiece.x, y: lockedPiece.y };
  }

  for (const absoluteCell of newAbsoluteCells) {
    nextField[absoluteCell.y][absoluteCell.x] = {
      type: lockedPiece.type,
      quarterTurns,
      sourceCellX: absoluteCell.x - inferredOrigin.x,
      sourceCellY: absoluteCell.y - inferredOrigin.y,
    };
  }

  return nextField;
}

function buildRenderedField(
  settledField: SettledFieldView,
  gameState: GameState,
): SettledFieldView {
  if (gameState.phase !== "LineClear" || gameState.pendingClearedRows.length === 0) {
    return settledField;
  }

  const renderedField = cloneSettledField(settledField);
  for (const rowIndex of gameState.pendingClearedRows) {
    renderedField[rowIndex].fill(null);
  }
  return renderedField;
}

function buildLineClearRows(
  settledField: SettledFieldView,
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
    cells: settledField[rowIndex]
      .map((cell, x) =>
        cell === null
          ? null
          : {
              x,
              type: cell.type,
              quarterTurns: cell.quarterTurns,
              sourceCellX: cell.sourceCellX,
              sourceCellY: cell.sourceCellY,
            },
      )
      .filter(
        (
          cell,
        ): cell is {
          x: number;
          type: Tetromino;
          quarterTurns: number;
          sourceCellX: number;
          sourceCellY: number;
        } => cell !== null,
      ),
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
  settledField: SettledFieldView,
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
    field: buildRenderedField(settledField, gameState),
    activePiece: gameState.activePiece,
    activePieceOffset: buildActivePieceOffset(
      activePieceMotionOffset,
      activePieceMotionFramesRemaining,
      entryMotionFramesRemaining,
      config,
    ),
    lineClearRows: buildLineClearRows(settledField, gameState, config),
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
  const settledField = buildInitialSettledField(gameState.field);
  return {
    config,
    settledField,
    queueSlideFramesRemaining: 0,
    impactShakeFramesRemaining: 0,
    activePieceMotionFramesRemaining: 0,
    entryMotionFramesRemaining: 0,
    hasTriggeredImpactShakeForCurrentPiece: false,
    activePieceMotionOffset: ZERO_CELL_OFFSET,
    view: buildView(settledField, gameState, 0, 0, ZERO_CELL_OFFSET, 0, 0, config),
  };
}

export function triggerImpactShake(
  presentationState: PresentationState,
  gameState: GameState,
): PresentationState {
  const impactShakeFramesRemaining = presentationState.config.impactShakeFrames;

  return {
    ...presentationState,
    impactShakeFramesRemaining,
    view: buildView(
      presentationState.settledField,
      gameState,
      presentationState.queueSlideFramesRemaining,
      impactShakeFramesRemaining,
      presentationState.activePieceMotionOffset,
      presentationState.activePieceMotionFramesRemaining,
      presentationState.entryMotionFramesRemaining,
      presentationState.config,
    ),
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

  const lockedPreviousPiece =
    previousGameState.activePiece !== null &&
    currentGameState.activePiece === null &&
    (currentGameState.phase === "ARE" || currentGameState.phase === "LineClear")
      ? previousGameState.activePiece
      : null;

  const settledFieldAfterLock =
    lockedPreviousPiece === null
      ? previousPresentationState.settledField
      : mergeLockedPieceIntoSettledField(
          previousPresentationState.settledField,
          currentGameState,
          lockedPreviousPiece,
        );

  const settledField =
    previousGameState.phase === "LineClear" &&
    currentGameState.phase === "ARE" &&
    previousGameState.pendingClearedRows.length > 0
      ? collapseSettledField(settledFieldAfterLock, previousGameState.pendingClearedRows)
      : settledFieldAfterLock;

  return {
    ...previousPresentationState,
    settledField,
    queueSlideFramesRemaining,
    impactShakeFramesRemaining,
    activePieceMotionFramesRemaining,
    entryMotionFramesRemaining,
    hasTriggeredImpactShakeForCurrentPiece:
      hasTriggeredImpactShakeForCurrentPiece || impactTriggered,
    activePieceMotionOffset,
    view: buildView(
      settledField,
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
