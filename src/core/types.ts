export type Tetromino = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Rotation = "spawn" | "right" | "reverse" | "left";
export type GamePhase = "ARE" | "Spawning" | "Active" | "LineClear" | "GameOver";
export type HorizontalDirection = "left" | "right";
export type RotationIntent = "cw" | "ccw";
export type FieldCell = Tetromino | null;
export type Field = FieldCell[][];

export interface CellOffset {
  x: number;
  y: number;
}

export interface Timings {
  are: number;
  lineAre: number;
  das: number;
  lockDelay: number;
  lineClearDelay: number;
}

export interface GameConfig {
  fieldWidth: number;
  fieldHeight: number;
  queueLength: number;
  previewCount: number;
  softDropInternalGravity: number;
  timings: Timings;
  gravityStartInternal: number;
  gravityPre20GMaxInternal: number;
  gravity20GInternal: number;
  gravity20GPieceCount: number;
  gravityExponent: number;
}

export interface ActivePiece {
  type: Tetromino;
  rotation: Rotation;
  x: number;
  y: number;
  gravityAccumulator: number;
  grounded: boolean;
  lockDelayRemaining: number;
}

export interface InputFrame {
  left: boolean;
  right: boolean;
  rotateCW: boolean;
  rotateCCW: boolean;
  up: boolean;
  down: boolean;
  shake?: boolean;
  reveal?: boolean;
}

export interface InputMemory {
  previousInput: InputFrame;
  dasDirection: HorizontalDirection | null;
  dasChargeFrames: number;
  storedIrs: RotationIntent | null;
}

export interface RandomizerState {
  history: Tetromino[];
  rngState: number;
  generatedCount: number;
}

export interface GameState {
  phase: GamePhase;
  field: Field;
  queue: Tetromino[];
  randomizer: RandomizerState;
  activePiece: ActivePiece | null;
  pieceCount: number;
  score: number;
  manualShakeUsedSinceLastClear: boolean;
  revealCharges: number;
  piecesTowardNextRevealCharge: number;
  gravityInternal: number;
  inputMemory: InputMemory;
  areFramesRemaining: number;
  lineClearFramesRemaining: number;
  pendingClearedRows: number[];
  config: GameConfig;
}
