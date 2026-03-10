import { describe, expect, it } from "vitest";

import { createRandomizerState, fillQueue, nextRandomPiece } from "../src/core/index.js";

describe("TGM randomizer", () => {
  it("never deals S, Z, or O as the first piece", () => {
    for (let seed = 1; seed <= 128; seed += 1) {
      const draw = nextRandomPiece(createRandomizerState(seed));
      expect(["S", "Z", "O"]).not.toContain(draw.piece);
    }
  });

  it("fills the queue deterministically from a seed", () => {
    const first = fillQueue(createRandomizerState(17), 4);
    const second = fillQueue(createRandomizerState(17), 4);

    expect(first.pieces).toEqual(second.pieces);
    expect(first.state).toEqual(second.state);
  });
});
