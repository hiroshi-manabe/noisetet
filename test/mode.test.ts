import { describe, expect, it } from "vitest";

import {
  createBootSession,
  isDebugMode,
  resolveBootMode,
} from "../src/app/mode.js";

describe("boot modes", () => {
  it("falls back to normal for unknown storage values", () => {
    expect(resolveBootMode(null)).toBe("normal");
    expect(resolveBootMode("mystery")).toBe("normal");
  });

  it("identifies debug-capable modes", () => {
    expect(isDebugMode("normal")).toBe(false);
    expect(isDebugMode("debug")).toBe(true);
    expect(isDebugMode("debug20g")).toBe(true);
  });

  it("starts debug modes paused", () => {
    expect(createBootSession("debug").paused).toBe(true);
    expect(createBootSession("debug20g").paused).toBe(true);
    expect(createBootSession("normal").paused).toBe(false);
  });

  it("boots debug20g at 20G conditions", () => {
    const session = createBootSession("debug20g");

    expect(session.state.pieceCount).toBe(500);
    expect(session.state.gravityInternal).toBe(5120);
    expect(session.state.score).toBe(0);
  });
});
