import type { GameConfig, GravityTier, Timings } from "./types.js";

export const FIELD_WIDTH = 10;
export const FIELD_HEIGHT = 21;
export const PREVIEW_COUNT = 3;
export const QUEUE_LENGTH = PREVIEW_COUNT + 1;

export const DEFAULT_TIMINGS: Timings = {
  are: 27,
  lineAre: 27,
  das: 16,
  lockDelay: 30,
  lineClearDelay: 40,
};

export const DEFAULT_GRAVITY_LADDER: GravityTier[] = [
  { minLockedPieces: 0, internalGravity: 4 },
  { minLockedPieces: 100, internalGravity: 32 },
  { minLockedPieces: 200, internalGravity: 64 },
  { minLockedPieces: 300, internalGravity: 128 },
  { minLockedPieces: 400, internalGravity: 256 },
  { minLockedPieces: 500, internalGravity: 512 },
  { minLockedPieces: 600, internalGravity: 768 },
  { minLockedPieces: 700, internalGravity: 1024 },
  { minLockedPieces: 800, internalGravity: 1280 },
  { minLockedPieces: 900, internalGravity: 5120 },
];

export const DEFAULT_CONFIG: GameConfig = {
  fieldWidth: FIELD_WIDTH,
  fieldHeight: FIELD_HEIGHT,
  queueLength: QUEUE_LENGTH,
  previewCount: PREVIEW_COUNT,
  softDropInternalGravity: 1024,
  timings: DEFAULT_TIMINGS,
  gravityLadder: DEFAULT_GRAVITY_LADDER,
};
