import { describe, expect, it } from "vitest";

import { createEmptyField, createInitialGameState, stepGame } from "../src/core/index.js";
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

function createLineClearState() {
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

  return stepGame(state, {
    left: false,
    right: false,
    rotateCW: false,
    rotateCCW: false,
    up: true,
    down: false,
  });
}

function createLineClearTransition() {
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

  return { previousState, currentState };
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

  it("applies entry motion when a new active piece spawns", () => {
    let previousGameState = createInitialGameState({ seed: 7 });
    let presentationState = createPresentationState(previousGameState);
    let nextGameState = previousGameState;

    for (let frame = 0; frame < previousGameState.config.timings.are + 1; frame += 1) {
      nextGameState = stepGame(previousGameState);
      presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);
      previousGameState = nextGameState;
    }

    expect(nextGameState.phase).toBe("Active");
    expect(presentationState.view.activePieceOffset.y).toBeLessThan(0);

    const initialOffsetY = presentationState.view.activePieceOffset.y;
    nextGameState = stepGame(previousGameState);
    presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);

    expect(presentationState.view.activePieceOffset.y).toBeGreaterThan(initialOffsetY);
  });

  it("applies horizontal interpolation when the active piece shifts", () => {
    const previousGameState = advanceToActiveState();
    let presentationState = createPresentationState(previousGameState);

    const nextGameState = stepGame(previousGameState, {
      left: false,
      right: true,
      rotateCW: false,
      rotateCCW: false,
      up: false,
      down: false,
    });
    presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);

    expect(nextGameState.activePiece?.x).toBe((previousGameState.activePiece?.x ?? 0) + 1);
    expect(presentationState.view.activePieceOffset.x).toBeLessThan(0);
  });

  it("applies vertical interpolation when gravity moves the active piece", () => {
    const baseGameState = advanceToActiveState();
    if (baseGameState.activePiece === null) {
      throw new Error("Expected an active piece for gravity interpolation test.");
    }

    const previousGameState = {
      ...baseGameState,
      activePiece: {
        ...baseGameState.activePiece,
        gravityAccumulator: 255,
      },
    };
    let presentationState = createPresentationState(previousGameState);

    const nextGameState = stepGame(previousGameState);
    presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);

    expect(nextGameState.activePiece?.y).toBe((previousGameState.activePiece?.y ?? 0) + 1);
    expect(presentationState.view.activePieceOffset.y).toBeLessThan(0);
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
    expect(presentationState.view.shakeOffset.x).toBe(0);
    expect(presentationState.view.shakeOffset.y).toBeGreaterThan(0);
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
    expect(presentationState.view.shakeOffset.x).toBe(0);
    expect(presentationState.view.shakeOffset.y).toBeGreaterThan(0);
  });

  it("builds a sliding overlay for cleared rows during line clear", () => {
    const { previousState: previousGameState, currentState: currentGameState } =
      createLineClearTransition();
    let presentationState = createPresentationState(previousGameState);

    presentationState = updatePresentationState(presentationState, previousGameState, currentGameState);

    expect(currentGameState.phase).toBe("LineClear");
    expect(presentationState.view.lineClearRows).toHaveLength(1);
    expect(presentationState.view.lineClearRows[0]?.y).toBe(20);
    expect(presentationState.view.lineClearRows[0]?.cells).toHaveLength(10);
    expect(presentationState.view.field[20].every((cell) => cell === null)).toBe(true);
    expect(presentationState.view.lineClearRows[0]?.xOffsetCells).toBe(0);
    expect(presentationState.view.lineClearRows[0]?.cells[0]?.quarterTurns).toBe(0);
  });

  it("advances the cleared-row slide over line-clear frames", () => {
    let previousGameState = createLineClearState();
    let presentationState = createPresentationState(previousGameState);

    let nextGameState = stepGame(previousGameState);
    presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);

    expect(nextGameState.phase).toBe("LineClear");
    expect(presentationState.view.lineClearRows[0]?.xOffsetCells).toBeLessThan(0);

    previousGameState = nextGameState;
    for (let frame = 0; frame < previousGameState.config.timings.lineClearDelay; frame += 1) {
      nextGameState = stepGame(previousGameState);
      presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);
      previousGameState = nextGameState;
      if (nextGameState.phase !== "LineClear") {
        break;
      }
    }

    expect(previousGameState.phase).toBe("ARE");
    expect(presentationState.view.lineClearRows).toHaveLength(0);
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

    let sawUpwardRecovery = false;

    for (let frame = 0; frame < presentationState.config.impactShakeFrames; frame += 1) {
      nextGameState = stepGame(previousGameState);
      presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);
      if (presentationState.view.shakeOffset.y < 0) {
        sawUpwardRecovery = true;
      }
      previousGameState = nextGameState;
    }

    expect(sawUpwardRecovery).toBe(true);
    expect(presentationState.impactShakeFramesRemaining).toBe(0);
    expect(presentationState.view.shakeOffset).toEqual({ x: 0, y: 0 });
  });

  it("preserves locked piece orientation in the settled field", () => {
    let previousGameState = advanceToActiveState();
    previousGameState = {
      ...previousGameState,
      activePiece: {
        type: "T",
        rotation: "right",
        x: 4,
        y: 18,
        gravityAccumulator: 0,
        grounded: true,
        lockDelayRemaining: 1,
      },
    };

    let presentationState = createPresentationState(previousGameState);
    const nextGameState = stepGame(previousGameState);
    presentationState = updatePresentationState(presentationState, previousGameState, nextGameState);

    expect(nextGameState.phase).toBe("ARE");
    expect(presentationState.view.field[18][5]).toEqual({
      type: "T",
      quarterTurns: 1,
      sourceCellX: 1,
      sourceCellY: 0,
    });
    expect(presentationState.view.field[19][4]).toEqual({
      type: "T",
      quarterTurns: 1,
      sourceCellX: 0,
      sourceCellY: 1,
    });
  });

  it("keeps locked orientation in the line-clear overlay before collapse", () => {
    const field = createEmptyField();
    for (let x = 0; x < 10; x += 1) {
      if (x !== 5) {
        field[20][x] = "I";
      }
    }

    let previousGameState = createInitialGameState({ seed: 7, field });
    for (let frame = 0; frame < previousGameState.config.timings.are + 1; frame += 1) {
      previousGameState = stepGame(previousGameState);
    }

    previousGameState = {
      ...previousGameState,
      activePiece: {
        type: "T",
        rotation: "right",
        x: 4,
        y: 18,
        gravityAccumulator: 0,
        grounded: false,
        lockDelayRemaining: previousGameState.config.timings.lockDelay,
      },
    };

    let presentationState = createPresentationState(previousGameState);
    const currentGameState = stepGame(previousGameState, {
      left: false,
      right: false,
      rotateCW: false,
      rotateCCW: false,
      up: true,
      down: false,
    });
    presentationState = updatePresentationState(presentationState, previousGameState, currentGameState);

    expect(currentGameState.phase).toBe("LineClear");
    const lockedCell = presentationState.view.lineClearRows[0]?.cells.find((cell) => cell.x === 5);
    expect(lockedCell).toEqual({
      x: 5,
      type: "T",
      quarterTurns: 1,
      sourceCellX: 1,
      sourceCellY: 2,
    });
  });
});
