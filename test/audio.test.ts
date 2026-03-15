import { describe, expect, it } from "vitest";

import { createEmptyField, createInitialGameState, stepGame } from "../src/core/index.js";
import { detectAudioEvents } from "../src/app/audio.js";

function advanceToActiveState() {
  let state = createInitialGameState({ seed: 7 });

  for (let frame = 0; frame < state.config.timings.are + 1; frame += 1) {
    state = stepGame(state);
  }

  return state;
}

describe("audio events", () => {
  it("plays impact when an active piece first grounds", () => {
    let previousState = advanceToActiveState();
    let currentState = previousState;

    while (currentState.activePiece?.grounded !== true) {
      previousState = currentState;
      currentState = stepGame(previousState);
    }

    expect(detectAudioEvents(previousState, currentState)).toEqual({
      playImpact: true,
      playLineClear: false,
    });
  });

  it("does not replay impact while the same piece remains grounded", () => {
    let previousState = advanceToActiveState();
    let currentState = previousState;

    while (currentState.activePiece?.grounded !== true) {
      previousState = currentState;
      currentState = stepGame(previousState);
    }

    const groundedState = currentState;
    const nextGroundedState = stepGame(groundedState);

    expect(detectAudioEvents(groundedState, nextGroundedState)).toEqual({
      playImpact: false,
      playLineClear: false,
    });
  });

  it("plays both impact and line-clear sounds on an airborne hard-drop clear", () => {
    const field = createEmptyField();
    for (let x = 4; x < 10; x += 1) {
      field[20][x] = "T";
    }

    let previousState = createInitialGameState({ seed: 7, field });
    for (let frame = 0; frame < previousState.config.timings.are + 1; frame += 1) {
      previousState = stepGame(previousState);
    }

    previousState = {
      ...previousState,
      activePiece: {
        type: "I",
        rotation: "spawn",
        x: 0,
        y: 0,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: previousState.config.timings.lockDelay,
      },
    };

    const currentState = stepGame(previousState, {
      left: false,
      right: false,
      rotateCW: false,
      rotateCCW: false,
      up: true,
      down: false,
    });

    expect(detectAudioEvents(previousState, currentState)).toEqual({
      playImpact: true,
      playLineClear: true,
    });
  });
});
