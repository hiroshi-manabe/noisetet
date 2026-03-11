import { describe, expect, it } from "vitest";

import { createInitialGameState, stepGame } from "../src/core/index.js";
import {
  createPresentationState,
  updatePresentationState,
} from "../src/presentation/index.js";

function advanceToActiveState() {
  let state = createInitialGameState({ seed: 7 });

  for (let frame = 0; frame < state.config.timings.are + 1; frame += 1) {
    state = stepGame(state);
  }

  return state;
}

describe("presentation state", () => {
  it("starts with no active presentation animations", () => {
    const gameState = createInitialGameState({ seed: 7 });
    const presentationState = createPresentationState(gameState);

    expect(presentationState.queueSlideFramesRemaining).toBe(0);
    expect(presentationState.impactShakeFramesRemaining).toBe(0);
    expect(presentationState.view.shakeOffset).toEqual({ x: 0, y: 0 });
  });

  it("starts queue slide when the preview queue advances", () => {
    let previousGameState = createInitialGameState({ seed: 7 });
    let presentationState = createPresentationState(previousGameState);

    for (let frame = 0; frame < previousGameState.config.timings.are + 1; frame += 1) {
      const nextGameState = stepGame(previousGameState);
      presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);
      previousGameState = nextGameState;
    }

    expect(previousGameState.phase).toBe("Active");
    expect(presentationState.queueSlideFramesRemaining).toBeGreaterThan(0);
    expect(presentationState.view.queuePreviews[0]?.yOffsetSlots).toBeGreaterThan(0);
  });

  it("starts impact shake on the first grounded contact", () => {
    let previousGameState = advanceToActiveState();
    let presentationState = createPresentationState(previousGameState);

    let nextGameState = previousGameState;
    while (nextGameState.activePiece?.grounded !== true) {
      previousGameState = nextGameState;
      nextGameState = stepGame(previousGameState);
      presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);
    }

    expect(nextGameState.phase).toBe("Active");
    expect(presentationState.impactShakeFramesRemaining).toBeGreaterThan(0);
    expect(Math.abs(presentationState.view.shakeOffset.x)).toBeGreaterThan(0);
  });

  it("starts impact shake on airborne hard drop lock", () => {
    const previousGameState = advanceToActiveState();
    let presentationState = createPresentationState(previousGameState);

    const nextGameState = stepGame(previousGameState, {
      left: false,
      right: false,
      rotateCW: false,
      rotateCCW: false,
      up: true,
      down: false,
    });
    presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);

    expect(previousGameState.activePiece?.grounded).toBe(false);
    expect(nextGameState.activePiece).toBeNull();
    expect(presentationState.impactShakeFramesRemaining).toBeGreaterThan(0);
    expect(Math.abs(presentationState.view.shakeOffset.x)).toBeGreaterThan(0);
  });

  it("does not retrigger impact shake after the same piece re-grounds", () => {
    const baseGameState = advanceToActiveState();
    const baseActivePiece = baseGameState.activePiece;
    if (baseActivePiece === null) {
      throw new Error("Expected an active piece for presentation test.");
    }

    let presentationState = createPresentationState(baseGameState);

    const firstGroundedState = {
      ...baseGameState,
      activePiece: {
        ...baseActivePiece,
        grounded: true,
      },
    };
    presentationState = updatePresentationState(presentationState, baseGameState, firstGroundedState);

    const firstShakeFrames = presentationState.impactShakeFramesRemaining;
    expect(firstShakeFrames).toBeGreaterThan(0);

    const liftedState = {
      ...firstGroundedState,
      activePiece: {
        ...firstGroundedState.activePiece,
        grounded: false,
        x: firstGroundedState.activePiece.x + 1,
      },
    };
    presentationState = updatePresentationState(presentationState, firstGroundedState, liftedState);

    const regroundedState = {
      ...liftedState,
      activePiece: {
        ...liftedState.activePiece,
        grounded: true,
      },
    };
    presentationState = updatePresentationState(presentationState, liftedState, regroundedState);

    expect(presentationState.impactShakeFramesRemaining).toBeLessThan(firstShakeFrames);
  });

  it("decays queue slide and impact shake over time", () => {
    let previousGameState = advanceToActiveState();
    let presentationState = createPresentationState(previousGameState);
    let nextGameState = previousGameState;

    while (nextGameState.activePiece?.grounded !== true) {
      previousGameState = nextGameState;
      nextGameState = stepGame(previousGameState);
      presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);
    }

    previousGameState = nextGameState;

    for (let frame = 0; frame < presentationState.config.impactShakeFrames; frame += 1) {
      nextGameState = stepGame(previousGameState);
      presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);
      previousGameState = nextGameState;
    }

    expect(presentationState.impactShakeFramesRemaining).toBe(0);
    expect(presentationState.view.shakeOffset).toEqual({ x: 0, y: 0 });
  });
});
