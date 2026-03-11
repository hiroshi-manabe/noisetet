import type { ActivePiece, Field, GamePhase, Tetromino } from "../core/types.js";

export interface PresentationConfig {
  queueSlideFrames: number;
  impactShakeFrames: number;
  impactShakeAmplitude: number;
}

export interface ShakeOffset {
  x: number;
  y: number;
}

export interface QueuePreviewItem {
  type: Tetromino;
  index: number;
  yOffsetSlots: number;
}

export interface PresentationView {
  phase: GamePhase;
  field: Field;
  activePiece: ActivePiece | null;
  queuePreviews: QueuePreviewItem[];
  pieceCount: number;
  gravityInternal: number;
  lockDelayRemaining: number | null;
  shakeOffset: ShakeOffset;
}

export interface PresentationState {
  config: PresentationConfig;
  queueSlideFramesRemaining: number;
  impactShakeFramesRemaining: number;
  hasTriggeredImpactShakeForCurrentPiece: boolean;
  view: PresentationView;
}
