import { DEFAULT_CONFIG } from "./config.js";
import { getCellsForPiece, rotatePiece } from "./pieces.js";
import { createRandomizerState, fillQueue, nextRandomPiece } from "./randomizer.js";
import type {
  ActivePiece,
  Field,
  FieldCell,
  GameConfig,
  GameState,
  HorizontalDirection,
  InputFrame,
  InputMemory,
  RotationIntent,
  Tetromino,
} from "./types.js";

export const EMPTY_INPUT: InputFrame = {
  left: false,
  right: false,
  rotateCW: false,
  rotateCCW: false,
  up: false,
  down: false,
  shake: false,
  reveal: false,
};

export const REVEAL_ITEM_PIECES_PER_CHARGE = 10;
export const REVEAL_ITEM_MAX_CHARGES = 3;

const SPAWN_X: Record<Tetromino, number> = {
  I: 3,
  O: 4,
  T: 3,
  S: 3,
  Z: 3,
  J: 3,
  L: 3,
};

function createInputMemory(): InputMemory {
  return {
    previousInput: EMPTY_INPUT,
    dasDirection: null,
    dasChargeFrames: 0,
    storedIrs: null,
  };
}

export function createEmptyField(
  width = DEFAULT_CONFIG.fieldWidth,
  height = DEFAULT_CONFIG.fieldHeight,
): Field {
  return Array.from({ length: height }, () => Array<FieldCell>(width).fill(null));
}

function cloneField(field: Field): Field {
  return field.map((row) => [...row]);
}

function resolveGravityInternal(pieceCount: number, config: GameConfig): number {
  if (pieceCount >= config.gravity20GPieceCount) {
    return config.gravity20GInternal;
  }

  const denominator = Math.max(1, config.gravity20GPieceCount - 1);
  const progress = Math.max(0, Math.min(1, pieceCount / denominator));
  const gravityStart = config.gravityStartInternal / 256;
  const gravityMax = config.gravityPre20GMaxInternal / 256;
  const gravityG =
    gravityStart + (gravityMax - gravityStart) * Math.pow(progress, config.gravityExponent);

  return Math.round(gravityG * 256);
}

export function createInitialGameState(options?: {
  seed?: number;
  config?: GameConfig;
  field?: Field;
  pieceCount?: number;
  score?: number;
}): GameState {
  const config = options?.config ?? DEFAULT_CONFIG;
  const initialField = options?.field ? cloneField(options.field) : createEmptyField(config.fieldWidth, config.fieldHeight);
  const randomizer = createRandomizerState(options?.seed ?? 1);
  const queueFill = fillQueue(randomizer, config.queueLength);
  const pieceCount = options?.pieceCount ?? 0;
  const score = options?.score ?? 0;

  return {
    phase: "ARE",
    field: initialField,
    queue: queueFill.pieces,
    randomizer: queueFill.state,
    activePiece: null,
    pieceCount,
    score,
    manualShakeUsedSinceLastClear: false,
    revealCharges: 0,
    piecesTowardNextRevealCharge: 0,
    gravityInternal: resolveGravityInternal(pieceCount, config),
    inputMemory: createInputMemory(),
    areFramesRemaining: config.timings.are,
    lineClearFramesRemaining: 0,
    pendingClearedRows: [],
    config,
  };
}

export function getGravityInternalForPieceCount(
  pieceCount: number,
  config = DEFAULT_CONFIG,
): number {
  return resolveGravityInternal(pieceCount, config);
}

function updateInputMemory(state: GameState, input: InputFrame): InputMemory {
  const previous = state.inputMemory.previousInput;
  const leftPressed = input.left && !previous.left;
  const rightPressed = input.right && !previous.right;
  const rotateCWPressed = input.rotateCW && !previous.rotateCW;
  const rotateCCWPressed = input.rotateCCW && !previous.rotateCCW;

  let dasDirection: HorizontalDirection | null = state.inputMemory.dasDirection;
  let dasChargeFrames = state.inputMemory.dasChargeFrames;
  let storedIrs: RotationIntent | null = state.inputMemory.storedIrs;

  if (leftPressed) {
    dasDirection = "left";
    dasChargeFrames = 0;
  } else if (rightPressed) {
    dasDirection = "right";
    dasChargeFrames = 0;
  } else if (input.left && input.right) {
    dasDirection =
      previous.right && !previous.left ? "right" : previous.left && !previous.right ? "left" : dasDirection;
    if (dasDirection !== null) {
      dasChargeFrames += 1;
    }
  } else if (input.left && !input.right && dasDirection === "left") {
    dasChargeFrames += 1;
  } else if (input.right && !input.left && dasDirection === "right") {
    dasChargeFrames += 1;
  } else {
    dasDirection = null;
    dasChargeFrames = 0;
  }

  if (state.phase === "ARE" || state.phase === "LineClear") {
    if (rotateCWPressed) {
      storedIrs = "cw";
    } else if (rotateCCWPressed) {
      storedIrs = "ccw";
    }
  }

  return {
    previousInput: input,
    dasDirection,
    dasChargeFrames,
    storedIrs,
  };
}

function wasPressed(current: boolean, previous: boolean): boolean {
  return current && !previous;
}

function getAbsoluteCells(piece: ActivePiece): CellOffsetWithOccupancy[] {
  return getCellsForPiece(piece).map((cell) => ({
    x: piece.x + cell.x,
    y: piece.y + cell.y,
  }));
}

interface CellOffsetWithOccupancy {
  x: number;
  y: number;
}

function canPlace(piece: ActivePiece, field: Field): boolean {
  const width = field[0]?.length ?? 0;
  const height = field.length;

  return getAbsoluteCells(piece).every((cell) => {
    if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) {
      return false;
    }

    return field[cell.y][cell.x] === null;
  });
}

function isGrounded(piece: ActivePiece, field: Field): boolean {
  const shifted: ActivePiece = { ...piece, y: piece.y + 1 };
  return !canPlace(shifted, field);
}

function firstCollisionLocalCell(piece: ActivePiece, field: Field): CellOffsetWithOccupancy | null {
  const width = field[0]?.length ?? 0;
  const height = field.length;

  const occupiedCells = getCellsForPiece(piece)
    .map((cell) => ({ ...cell }))
    .sort((left, right) => left.y - right.y || left.x - right.x);

  for (const cell of occupiedCells) {
    const x = piece.x + cell.x;
    const y = piece.y + cell.y;
    if (x < 0 || x >= width || y < 0 || y >= height || field[y][x] !== null) {
      return cell;
    }
  }

  return null;
}

function isCenterColumnKickBlocked(currentPiece: ActivePiece, rotatedPiece: ActivePiece, field: Field): boolean {
  if (!["T", "J", "L"].includes(currentPiece.type)) {
    return false;
  }

  if (!["spawn", "reverse"].includes(currentPiece.rotation)) {
    return false;
  }

  const collision = firstCollisionLocalCell(rotatedPiece, field);
  return collision?.x === 1;
}

function tryRotatePiece(
  piece: ActivePiece,
  field: Field,
  direction: RotationIntent,
): ActivePiece {
  const rotated: ActivePiece = {
    ...piece,
    rotation: rotatePiece(piece.type, piece.rotation, direction),
  };

  if (canPlace(rotated, field)) {
    return rotated;
  }

  if (piece.type === "I") {
    return piece;
  }

  if (isCenterColumnKickBlocked(piece, rotated, field)) {
    return piece;
  }

  const kickRight = { ...rotated, x: rotated.x + 1 };
  if (canPlace(kickRight, field)) {
    return kickRight;
  }

  const kickLeft = { ...rotated, x: rotated.x - 1 };
  if (canPlace(kickLeft, field)) {
    return kickLeft;
  }

  return piece;
}

function tryShiftPiece(piece: ActivePiece, field: Field, direction: HorizontalDirection): ActivePiece {
  const shifted: ActivePiece = {
    ...piece,
    x: piece.x + (direction === "left" ? -1 : 1),
  };

  return canPlace(shifted, field) ? shifted : piece;
}

function applyStoredIrs(piece: ActivePiece, intent: RotationIntent | null, field: Field): ActivePiece {
  if (intent === null) {
    return piece;
  }

  return tryRotatePiece(piece, field, intent);
}

function applySpawnLateralIntent(
  piece: ActivePiece,
  direction: HorizontalDirection | null,
  field: Field,
): ActivePiece {
  if (direction === null) {
    return piece;
  }

  const shifted: ActivePiece = {
    ...piece,
    x: piece.x + (direction === "left" ? -1 : 1),
  };

  return canPlace(shifted, field) ? shifted : piece;
}

function createSpawnPiece(type: Tetromino, config: GameConfig): ActivePiece {
  return {
    type,
    rotation: "spawn",
    x: SPAWN_X[type],
    y: 0,
    gravityAccumulator: 0,
    grounded: false,
    lockDelayRemaining: config.timings.lockDelay,
  };
}

function fillQueueToLength(
  queue: Tetromino[],
  randomizer: GameState["randomizer"],
  length: number,
): { queue: Tetromino[]; randomizer: GameState["randomizer"] } {
  let nextQueue = [...queue];
  let nextRandomizer = randomizer;

  while (nextQueue.length < length) {
    const draw = nextRandomPiece(nextRandomizer);
    nextQueue.push(draw.piece);
    nextRandomizer = draw.state;
  }

  return { queue: nextQueue, randomizer: nextRandomizer };
}

function findHardDropY(piece: ActivePiece, field: Field): number {
  let current = piece;

  while (canPlace({ ...current, y: current.y + 1 }, field)) {
    current = { ...current, y: current.y + 1 };
  }

  return current.y;
}

function mergePieceIntoField(field: Field, piece: ActivePiece): Field {
  const nextField = cloneField(field);

  for (const cell of getAbsoluteCells(piece)) {
    nextField[cell.y][cell.x] = piece.type;
  }

  return nextField;
}

function detectClearedRows(field: Field): number[] {
  const clearedRows: number[] = [];

  for (let y = 0; y < field.length; y += 1) {
    if (field[y].every((cell) => cell !== null)) {
      clearedRows.push(y);
    }
  }

  return clearedRows;
}

function collapseField(field: Field, clearedRows: number[]): Field {
  if (clearedRows.length === 0) {
    return cloneField(field);
  }

  const remainingRows = field.filter((_, index) => !clearedRows.includes(index));
  const emptyRows = Array.from({ length: clearedRows.length }, () =>
    Array<FieldCell>(field[0].length).fill(null),
  );

  return [...emptyRows, ...remainingRows];
}

function isFieldEmpty(field: Field): boolean {
  return field.every((row) => row.every((cell) => cell === null));
}

const SCORE_BY_LINES: Record<number, number> = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

function calculateScoreGain(
  linesCleared: number,
  piecesBeforeLock: number,
  bravo: boolean,
  noShakeReward: boolean,
): number {
  const baseScore = SCORE_BY_LINES[linesCleared] ?? 0;
  if (baseScore === 0) {
    return 0;
  }

  const scaledScore = Math.floor(baseScore * ((100 + piecesBeforeLock) / 100));
  return scaledScore * (bravo ? 4 : 1) * (noShakeReward ? 2 : 1);
}

function accrueRevealCharges(
  state: GameState,
  lockedPieces: number,
): Pick<GameState, "revealCharges" | "piecesTowardNextRevealCharge"> {
  if (lockedPieces <= 0) {
    return {
      revealCharges: state.revealCharges,
      piecesTowardNextRevealCharge: state.piecesTowardNextRevealCharge,
    };
  }

  if (state.revealCharges >= REVEAL_ITEM_MAX_CHARGES) {
    return {
      revealCharges: state.revealCharges,
      piecesTowardNextRevealCharge: state.piecesTowardNextRevealCharge,
    };
  }

  let revealCharges = state.revealCharges;
  let piecesTowardNextRevealCharge = state.piecesTowardNextRevealCharge + lockedPieces;

  while (
    piecesTowardNextRevealCharge >= REVEAL_ITEM_PIECES_PER_CHARGE &&
    revealCharges < REVEAL_ITEM_MAX_CHARGES
  ) {
    piecesTowardNextRevealCharge -= REVEAL_ITEM_PIECES_PER_CHARGE;
    revealCharges += 1;
  }

  return {
    revealCharges,
    piecesTowardNextRevealCharge,
  };
}

function applyGravity(
  piece: ActivePiece,
  field: Field,
  internalGravity: number,
): { piece: ActivePiece; rowsMoved: number } {
  if (internalGravity >= 5120) {
    const hardSettledY = findHardDropY(piece, field);
    return {
      piece: { ...piece, y: hardSettledY, gravityAccumulator: 0 },
      rowsMoved: hardSettledY - piece.y,
    };
  }

  let nextPiece = { ...piece };
  let rowsMoved = 0;
  let gravityAccumulator = piece.gravityAccumulator + internalGravity;

  while (gravityAccumulator >= 256) {
    const candidate = { ...nextPiece, y: nextPiece.y + 1 };
    if (!canPlace(candidate, field)) {
      break;
    }

    nextPiece = candidate;
    rowsMoved += 1;
    gravityAccumulator -= 256;
  }

  nextPiece.gravityAccumulator = gravityAccumulator;
  return { piece: nextPiece, rowsMoved };
}

function lockCurrentPiece(state: GameState, piece: ActivePiece): GameState {
  const lockedField = mergePieceIntoField(state.field, piece);
  const pendingClearedRows = detectClearedRows(lockedField);
  const nextPieceCount = state.pieceCount + 1;
  const collapsedField =
    pendingClearedRows.length > 0 ? collapseField(lockedField, pendingClearedRows) : lockedField;
  const nextScore =
    state.score +
    calculateScoreGain(
      pendingClearedRows.length,
      state.pieceCount,
      pendingClearedRows.length > 0 && isFieldEmpty(collapsedField),
      !state.manualShakeUsedSinceLastClear,
    );
  const revealProgress = accrueRevealCharges(state, 1);

  if (pendingClearedRows.length > 0) {
    return {
      ...state,
      phase: "LineClear",
      field: lockedField,
      activePiece: null,
      pieceCount: nextPieceCount,
      score: nextScore,
      manualShakeUsedSinceLastClear: false,
      revealCharges: revealProgress.revealCharges,
      piecesTowardNextRevealCharge: revealProgress.piecesTowardNextRevealCharge,
      gravityInternal: resolveGravityInternal(nextPieceCount, state.config),
      lineClearFramesRemaining: state.config.timings.lineClearDelay,
      pendingClearedRows,
    };
  }

  return {
    ...state,
    phase: "ARE",
    field: lockedField,
    activePiece: null,
    pieceCount: nextPieceCount,
    score: nextScore,
    manualShakeUsedSinceLastClear: state.manualShakeUsedSinceLastClear,
    revealCharges: revealProgress.revealCharges,
    piecesTowardNextRevealCharge: revealProgress.piecesTowardNextRevealCharge,
    gravityInternal: resolveGravityInternal(nextPieceCount, state.config),
    areFramesRemaining: state.config.timings.are,
    pendingClearedRows: [],
    lineClearFramesRemaining: 0,
  };
}

function stepAreState(state: GameState): GameState {
  const nextAre = Math.max(0, state.areFramesRemaining - 1);

  if (nextAre === 0) {
    return {
      ...state,
      phase: "Spawning",
      areFramesRemaining: 0,
    };
  }

  return {
    ...state,
    areFramesRemaining: nextAre,
  };
}

function stepSpawningState(state: GameState): GameState {
  const [nextType, ...remainingQueue] = state.queue;
  if (nextType === undefined) {
    throw new Error("Queue underflow during spawn.");
  }

  const refilled = fillQueueToLength(remainingQueue, state.randomizer, state.config.queueLength);
  let piece = createSpawnPiece(nextType, state.config);
  piece = applyStoredIrs(piece, state.inputMemory.storedIrs, state.field);
  piece = applySpawnLateralIntent(piece, state.inputMemory.dasDirection, state.field);

  if (!canPlace(piece, state.field)) {
    return {
      ...state,
      phase: "GameOver",
      queue: refilled.queue,
      randomizer: refilled.randomizer,
      activePiece: piece,
      inputMemory: {
        ...state.inputMemory,
        storedIrs: null,
      },
    };
  }

  if (state.gravityInternal >= state.config.gravity20GInternal) {
    piece = {
      ...applyGravity(piece, state.field, state.gravityInternal).piece,
      grounded: true,
      lockDelayRemaining: state.config.timings.lockDelay,
    };
  }

  return {
    ...state,
    phase: "Active",
    queue: refilled.queue,
    randomizer: refilled.randomizer,
    activePiece: {
      ...piece,
      grounded: isGrounded(piece, state.field),
    },
    inputMemory: {
      ...state.inputMemory,
      storedIrs: null,
    },
  };
}

function stepActiveState(state: GameState, input: InputFrame, previousInput: InputFrame): GameState {
  const activePiece = state.activePiece;
  if (activePiece === null) {
    return state;
  }

  const rotateCWPressed = wasPressed(input.rotateCW, previousInput.rotateCW);
  const rotateCCWPressed = wasPressed(input.rotateCCW, previousInput.rotateCCW);
  const leftPressed = wasPressed(input.left, previousInput.left);
  const rightPressed = wasPressed(input.right, previousInput.right);
  const upPressed = wasPressed(input.up, previousInput.up);
  const downPressed = wasPressed(input.down, previousInput.down);

  let nextPiece = activePiece;

  if (rotateCWPressed) {
    nextPiece = tryRotatePiece(nextPiece, state.field, "cw");
  } else if (rotateCCWPressed) {
    nextPiece = tryRotatePiece(nextPiece, state.field, "ccw");
  }

  if (leftPressed) {
    nextPiece = tryShiftPiece(nextPiece, state.field, "left");
  } else if (rightPressed) {
    nextPiece = tryShiftPiece(nextPiece, state.field, "right");
  } else if (
    state.inputMemory.dasDirection !== null &&
    state.inputMemory.dasChargeFrames >= state.config.timings.das
  ) {
    nextPiece = tryShiftPiece(nextPiece, state.field, state.inputMemory.dasDirection);
  }

  if (upPressed) {
    const hardDropped = {
      ...nextPiece,
      y: findHardDropY(nextPiece, state.field),
      grounded: true,
    };
    return lockCurrentPiece(state, hardDropped);
  }

  if (downPressed && isGrounded(nextPiece, state.field)) {
    return lockCurrentPiece(state, { ...nextPiece, grounded: true });
  }

  const effectiveGravity = input.down
    ? Math.max(state.gravityInternal, state.config.softDropInternalGravity)
    : state.gravityInternal;
  const gravityResult = applyGravity(nextPiece, state.field, effectiveGravity);
  nextPiece = gravityResult.piece;
  const groundedBefore = activePiece.grounded;
  const groundedAfter = isGrounded(nextPiece, state.field);

  if (gravityResult.rowsMoved > 0) {
    nextPiece = {
      ...nextPiece,
      grounded: groundedAfter,
      lockDelayRemaining: state.config.timings.lockDelay,
    };
  } else if (groundedAfter && !groundedBefore) {
    nextPiece = {
      ...nextPiece,
      grounded: true,
      lockDelayRemaining: state.config.timings.lockDelay,
    };
  } else if (groundedAfter && groundedBefore) {
    nextPiece = {
      ...nextPiece,
      grounded: true,
      lockDelayRemaining: nextPiece.lockDelayRemaining - 1,
    };
  } else {
    nextPiece = {
      ...nextPiece,
      grounded: false,
    };
  }

  if (nextPiece.grounded && nextPiece.lockDelayRemaining <= 0) {
    return lockCurrentPiece(state, nextPiece);
  }

  return {
    ...state,
    activePiece: nextPiece,
  };
}

function stepLineClearState(state: GameState): GameState {
  const nextDelay = Math.max(0, state.lineClearFramesRemaining - 1);
  if (nextDelay > 0) {
    return {
      ...state,
      lineClearFramesRemaining: nextDelay,
    };
  }

  return {
    ...state,
    phase: "ARE",
    field: collapseField(state.field, state.pendingClearedRows),
    pendingClearedRows: [],
    lineClearFramesRemaining: 0,
    areFramesRemaining: state.config.timings.lineAre,
  };
}

export function stepGame(state: GameState, input: InputFrame = EMPTY_INPUT): GameState {
  const previousInput = state.inputMemory.previousInput;
  const nextInputMemory = updateInputMemory(state, input);
  const shakePressed = Boolean(input.shake) && !Boolean(previousInput.shake);
  const revealPressed = Boolean(input.reveal) && !Boolean(previousInput.reveal);
  const revealConsumed =
    state.phase !== "GameOver" &&
    revealPressed &&
    state.revealCharges > 0;
  const nextState: GameState = {
    ...state,
    manualShakeUsedSinceLastClear:
      state.manualShakeUsedSinceLastClear || shakePressed || revealConsumed,
    revealCharges: revealConsumed ? state.revealCharges - 1 : state.revealCharges,
    inputMemory: nextInputMemory,
  };

  switch (state.phase) {
    case "ARE":
      return stepAreState(nextState);
    case "Spawning":
      return stepSpawningState(nextState);
    case "Active":
      return stepActiveState(nextState, input, previousInput);
    case "LineClear":
      return stepLineClearState(nextState);
    case "GameOver":
      return nextState;
    default:
      return nextState;
  }
}
