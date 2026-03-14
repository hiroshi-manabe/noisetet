import type { ActivePiece, GamePhase, Tetromino } from "../core/types.js";

export interface PresentationConfig {
  queueSlideFrames: number;
  impactShakeFrames: number;
  impactShakeAmplitude: number;
  lineClearSlideDistanceCells: number;
  activePieceMotionFrames: number;
  entryMotionFrames: number;
  entryMotionDistanceCells: number;
}

export interface ShakeOffset {
  x: number;
  y: number;
}

export interface CellOffsetFloat {
  x: number;
  y: number;
}

export interface QueuePreviewItem {
  type: Tetromino;
  index: number;
  yOffsetSlots: number;
}

export interface LineClearCellView {
  x: number;
  type: Tetromino;
  quarterTurns: number;
  sourceCellX: number;
  sourceCellY: number;
}

export interface LineClearRowView {
  y: number;
  xOffsetCells: number;
  cells: LineClearCellView[];
}

export interface SettledCellView {
  type: Tetromino;
  quarterTurns: number;
  sourceCellX: number;
  sourceCellY: number;
}

export type SettledFieldView = Array<Array<SettledCellView | null>>;

export interface PresentationView {
  phase: GamePhase;
  field: SettledFieldView;
  activePiece: ActivePiece | null;
  activePieceOffset: CellOffsetFloat;
  lineClearRows: LineClearRowView[];
  queuePreviews: QueuePreviewItem[];
  pieceCount: number;
  score: number;
  gravityInternal: number;
  lockDelayRemaining: number | null;
  shakeOffset: ShakeOffset;
}

export interface PresentationState {
  config: PresentationConfig;
  settledField: SettledFieldView;
  queueSlideFramesRemaining: number;
  impactShakeFramesRemaining: number;
  activePieceMotionFramesRemaining: number;
  entryMotionFramesRemaining: number;
  hasTriggeredImpactShakeForCurrentPiece: boolean;
  activePieceMotionOffset: CellOffsetFloat;
  view: PresentationView;
}
