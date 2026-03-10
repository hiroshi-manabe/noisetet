import { describe, expect, it } from "vitest";

import {
  createEmptyField,
  createInitialGameState,
  getGravityInternalForPieceCount,
  stepGame,
} from "../src/core/index.js";

describe("game state", () => {
  it("creates an initial ARE state with a prefilled queue", () => {
    const state = createInitialGameState({ seed: 7 });

    expect(state.phase).toBe("ARE");
    expect(state.queue).toHaveLength(4);
    expect(state.activePiece).toBeNull();
  });

  it("transitions from ARE to Spawning to Active", () => {
    let state = createInitialGameState({ seed: 7 });

    for (let frame = 0; frame < state.config.timings.are; frame += 1) {
      state = stepGame(state);
    }

    expect(state.phase).toBe("Spawning");

    state = stepGame(state);

    expect(state.phase).toBe("Active");
    expect(state.activePiece).not.toBeNull();
    expect(state.queue).toHaveLength(4);
  });

  it("enters GameOver when the spawn position is blocked", () => {
    const field = createEmptyField();
    field[0][3] = "I";
    field[0][4] = "I";
    field[0][5] = "I";
    field[1][4] = "I";

    let state = createInitialGameState({ seed: 7, field });

    for (let frame = 0; frame < state.config.timings.are; frame += 1) {
      state = stepGame(state);
    }

    state = stepGame(state);

    expect(state.phase).toBe("GameOver");
  });

  it("hard-drops and locks immediately", () => {
    let state = createInitialGameState({ seed: 7 });

    for (let frame = 0; frame < state.config.timings.are + 1; frame += 1) {
      state = stepGame(state);
    }

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: false,
      rotateCCW: false,
      up: true,
      down: false,
    });

    expect(state.phase).toBe("ARE");
    expect(state.activePiece).toBeNull();
    expect(state.pieceCount).toBe(1);
  });

  it("enters LineClear and collapses the field after the delay", () => {
    const field = createEmptyField();
    for (let x = 4; x < 10; x += 1) {
      field[20][x] = "T";
    }

    let state = createInitialGameState({ seed: 7, field });

    for (let frame = 0; frame < state.config.timings.are + 1; frame += 1) {
      state = stepGame(state);
    }

    state = {
      ...state,
      activePiece: {
        type: "I",
        rotation: "spawn",
        x: 0,
        y: 0,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: state.config.timings.lockDelay,
      },
    };

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: false,
      rotateCCW: false,
      up: true,
      down: false,
    });

    expect(state.phase).toBe("LineClear");
    expect(state.pendingClearedRows).toEqual([20]);

    for (let frame = 0; frame < state.config.timings.lineClearDelay; frame += 1) {
      state = stepGame(state);
    }

    expect(state.phase).toBe("ARE");
    expect(state.pendingClearedRows).toEqual([]);
    expect(state.field[20].every((cell) => cell === null)).toBe(true);
  });

  it("uses the custom piece-count gravity ladder", () => {
    expect(getGravityInternalForPieceCount(0)).toBe(4);
    expect(getGravityInternalForPieceCount(100)).toBe(32);
    expect(getGravityInternalForPieceCount(400)).toBe(256);
    expect(getGravityInternalForPieceCount(900)).toBe(5120);
    expect(getGravityInternalForPieceCount(1400)).toBe(5120);
  });
});
