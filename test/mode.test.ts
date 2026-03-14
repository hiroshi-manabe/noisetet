import { describe, expect, it } from "vitest";

import {
  BOOT_MODE_ENV_KEY,
  createBootSession,
  isDebugMode,
  resolveBootMode,
  resolveBootModeFromSources,
  resolveBootSeed,
} from "../src/app/mode.js";

describe("boot modes", () => {
  it("falls back to normal for unknown storage values", () => {
    expect(resolveBootMode(null)).toBe("normal");
    expect(resolveBootMode("mystery")).toBe("normal");
  });

  it("accepts explicit normal mode strings", () => {
    expect(resolveBootMode("normal")).toBe("normal");
  });

  it("prefers the env-configured boot mode over storage", () => {
    expect(resolveBootModeFromSources("debug20g", "debug")).toBe("debug20g");
    expect(resolveBootModeFromSources("normal", "debug")).toBe("normal");
    expect(resolveBootModeFromSources(undefined, "debug")).toBe("debug");
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

  it("uses time-derived seed only for normal mode", () => {
    expect(resolveBootSeed("normal", 123456789)).toBe(123456789);
    expect(resolveBootSeed("debug", 123456789)).toBe(7);
    expect(resolveBootSeed("debug20g", 123456789)).toBe(7);
  });

  it("boots debug20g at 20G conditions", () => {
    const session = createBootSession("debug20g");

    expect(session.state.pieceCount).toBe(500);
    expect(session.state.gravityInternal).toBe(5120);
    expect(session.state.score).toBe(0);
  });

  it("exports the Vite env key used for boot mode", () => {
    expect(BOOT_MODE_ENV_KEY).toBe("VITE_BOOT_MODE");
  });
});
