import type { GameConfig, Timings } from "./types.js";

export const FIELD_WIDTH = 10;
export const FIELD_HEIGHT = 21;
export const PREVIEW_COUNT = 3;
export const QUEUE_LENGTH = PREVIEW_COUNT + 1;

export const DEFAULT_TIMINGS: Timings = {
  are: 16,
  lineAre: 12,
  das: 16,
  lockDelay: 30,
  lineClearDelay: 12,
};

export const DEFAULT_CONFIG: GameConfig = {
  fieldWidth: FIELD_WIDTH,
  fieldHeight: FIELD_HEIGHT,
  queueLength: QUEUE_LENGTH,
  previewCount: PREVIEW_COUNT,
  softDropInternalGravity: 256,
  timings: DEFAULT_TIMINGS,
  gravityStartInternal: 4,
  gravityPre20GMaxInternal: 1280,
  gravity20GInternal: 5120,
  gravity20GPieceCount: 500,
  gravityExponent: 2,
};
