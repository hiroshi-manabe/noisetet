import { describe, expect, it } from "vitest";

import {
  createEmptyField,
  createInitialGameState,
  getGravityInternalForPieceCount,
  stepGame,
} from "../src/core/index.js";

function advanceToActiveState() {
  let state = createInitialGameState({ seed: 7 });

  for (let frame = 0; frame < state.config.timings.are + 1; frame += 1) {
    state = stepGame(state);
  }

  return state;
}

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
    let state = advanceToActiveState();

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

  it("moves one cell on a new horizontal press", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      activePiece: {
        type: "T",
        rotation: "spawn",
        x: 3,
        y: 0,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: state.config.timings.lockDelay,
      },
    };

    state = stepGame(state, {
      left: false,
      right: true,
      rotateCW: false,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.x).toBe(4);
  });

  it("repeats horizontal movement after DAS charge", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      activePiece: {
        type: "O",
        rotation: "spawn",
        x: 3,
        y: 0,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: state.config.timings.lockDelay,
      },
    };

    const holdRight = {
      left: false,
      right: true,
      rotateCW: false,
      rotateCCW: false,
      up: false,
      down: false,
    };

    state = stepGame(state, holdRight);
    expect(state.activePiece?.x).toBe(4);

    for (let frame = 0; frame < state.config.timings.das - 1; frame += 1) {
      state = stepGame(state, holdRight);
    }

    expect(state.activePiece?.x).toBe(4);

    state = stepGame(state, holdRight);
    expect(state.activePiece?.x).toBe(5);
  });

  it("rotates a piece clockwise in the active state", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      activePiece: {
        type: "T",
        rotation: "spawn",
        x: 3,
        y: 0,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: state.config.timings.lockDelay,
      },
    };

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.rotation).toBe("right");
  });

  it("keeps O rotation as a no-op", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      activePiece: {
        type: "O",
        rotation: "spawn",
        x: 3,
        y: 0,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: state.config.timings.lockDelay,
      },
    };

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.rotation).toBe("spawn");
  });

  it("treats I rotation as a two-state toggle", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      activePiece: {
        type: "I",
        rotation: "spawn",
        x: 3,
        y: 0,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: state.config.timings.lockDelay,
      },
    };

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });
    expect(state.activePiece?.rotation).toBe("right");

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: false,
      rotateCCW: false,
      up: false,
      down: false,
    });

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });
    expect(state.activePiece?.rotation).toBe("spawn");
  });

  it("applies IRS during spawning with the same ARS rotation rules", () => {
    let state = createInitialGameState({ seed: 7 });

    for (let frame = 0; frame < state.config.timings.are - 1; frame += 1) {
      state = stepGame(state);
    }

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });
    expect(state.phase).toBe("Spawning");

    state = stepGame(state);

    expect(state.phase).toBe("Active");
    expect(state.activePiece?.rotation).toBe("right");
  });

  it("allows a non-I piece to kick right when the base rotation is blocked off-center", () => {
    let state = advanceToActiveState();
    const field = createEmptyField();
    field[1][0] = "O";

    state = {
      ...state,
      field,
      activePiece: {
        type: "T",
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
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.rotation).toBe("right");
    expect(state.activePiece?.x).toBe(1);
  });

  it("does not kick the I piece when its base rotation is blocked", () => {
    let state = advanceToActiveState();
    const field = createEmptyField();
    field[1][1] = "O";

    state = {
      ...state,
      field,
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
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.rotation).toBe("spawn");
    expect(state.activePiece?.x).toBe(0);
  });

  it("does not allow an LJT kick when the first blocking cell is in the center column", () => {
    let state = advanceToActiveState();
    const field = createEmptyField();
    field[1][1] = "O";

    state = {
      ...state,
      field,
      activePiece: {
        type: "T",
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
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.rotation).toBe("spawn");
    expect(state.activePiece?.x).toBe(0);
  });

  it("allows an LJT kick when an off-center blocking cell is encountered first", () => {
    let state = advanceToActiveState();
    const field = createEmptyField();
    field[0][0] = "O";
    field[1][1] = "O";

    state = {
      ...state,
      field,
      activePiece: {
        type: "L",
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
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.rotation).toBe("right");
    expect(state.activePiece?.x).toBe(1);
  });

  it("does not reset lock delay on grounded lateral movement", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      gravityInternal: 0,
      activePiece: {
        type: "O",
        rotation: "spawn",
        x: 3,
        y: 19,
        gravityAccumulator: 0,
        grounded: true,
        lockDelayRemaining: 5,
      },
    };

    state = stepGame(state, {
      left: false,
      right: true,
      rotateCW: false,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.x).toBe(4);
    expect(state.activePiece?.grounded).toBe(true);
    expect(state.activePiece?.lockDelayRemaining).toBe(4);
  });

  it("does not reset lock delay on grounded rotation", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      gravityInternal: 0,
      activePiece: {
        type: "T",
        rotation: "spawn",
        x: 3,
        y: 18,
        gravityAccumulator: 0,
        grounded: true,
        lockDelayRemaining: 5,
      },
    };

    state = stepGame(state, {
      left: false,
      right: false,
      rotateCW: true,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.rotation).toBe("right");
    expect(state.activePiece?.grounded).toBe(true);
    expect(state.activePiece?.lockDelayRemaining).toBe(4);
  });

  it("settles to the resting height immediately at 20G", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      gravityInternal: 5120,
      activePiece: {
        type: "O",
        rotation: "spawn",
        x: 3,
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
      up: false,
      down: false,
    });

    expect(state.activePiece?.y).toBe(19);
    expect(state.activePiece?.grounded).toBe(true);
    expect(state.activePiece?.lockDelayRemaining).toBe(state.config.timings.lockDelay);
  });

  it("applies input before 20G settling", () => {
    let state = advanceToActiveState();

    state = {
      ...state,
      gravityInternal: 5120,
      activePiece: {
        type: "O",
        rotation: "spawn",
        x: 3,
        y: 0,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: state.config.timings.lockDelay,
      },
    };

    state = stepGame(state, {
      left: false,
      right: true,
      rotateCW: false,
      rotateCCW: false,
      up: false,
      down: false,
    });

    expect(state.activePiece?.x).toBe(4);
    expect(state.activePiece?.y).toBe(19);
    expect(state.activePiece?.grounded).toBe(true);
  });
});
