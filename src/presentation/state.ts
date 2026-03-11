import type { GameState } from "../core/types.js";
import type {
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
};

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

function buildView(
  gameState: GameState,
  queueSlideFramesRemaining: number,
  impactShakeFramesRemaining: number,
  config: PresentationConfig,
): PresentationView {
  return {
    phase: gameState.phase,
    field: gameState.field,
    activePiece: gameState.activePiece,
    queuePreviews: buildQueuePreviews(gameState, queueSlideFramesRemaining, config),
    pieceCount: gameState.pieceCount,
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
    hasTriggeredImpactShakeForCurrentPiece: false,
    view: buildView(gameState, 0, 0, config),
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

  return {
    ...previousPresentationState,
    queueSlideFramesRemaining,
    impactShakeFramesRemaining,
    hasTriggeredImpactShakeForCurrentPiece:
      hasTriggeredImpactShakeForCurrentPiece || impactTriggered,
    view: buildView(
      currentGameState,
      queueSlideFramesRemaining,
      impactShakeFramesRemaining,
      previousPresentationState.config,
    ),
  };
}
