import type { RandomizerState, Tetromino } from "./types.js";

const PIECES: readonly Tetromino[] = ["I", "O", "T", "S", "Z", "J", "L"];
const FIRST_PIECE_DISALLOWED = new Set<Tetromino>(["S", "Z", "O"]);
const INITIAL_HISTORY: readonly Tetromino[] = ["Z", "Z", "S", "S"];

function nextUint32(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function nextInt(seed: number, maxExclusive: number): { value: number; seed: number } {
  const newSeed = nextUint32(seed);
  return { value: newSeed % maxExclusive, seed: newSeed };
}

export function createRandomizerState(seed = 1): RandomizerState {
  return {
    history: [...INITIAL_HISTORY],
    rngState: seed >>> 0,
    generatedCount: 0,
  };
}

export function nextRandomPiece(
  state: RandomizerState,
): { piece: Tetromino; state: RandomizerState } {
  let rngState = state.rngState;
  let candidate: Tetromino = "I";

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const draw = nextInt(rngState, PIECES.length);
    rngState = draw.seed;
    candidate = PIECES[draw.value];

    if (state.generatedCount === 0 && FIRST_PIECE_DISALLOWED.has(candidate)) {
      continue;
    }

    if (!state.history.includes(candidate)) {
      break;
    }
  }

  const nextState: RandomizerState = {
    history: [candidate, ...state.history.slice(0, 3)],
    rngState,
    generatedCount: state.generatedCount + 1,
  };

  return { piece: candidate, state: nextState };
}

export function fillQueue(
  state: RandomizerState,
  count: number,
): { pieces: Tetromino[]; state: RandomizerState } {
  const pieces: Tetromino[] = [];
  let nextState = state;

  while (pieces.length < count) {
    const draw = nextRandomPiece(nextState);
    pieces.push(draw.piece);
    nextState = draw.state;
  }

  return { pieces, state: nextState };
}
