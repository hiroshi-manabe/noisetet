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
    expect(resolveBootModeFromSources("normal", "debug")).toBe("normal");
    expect(resolveBootModeFromSources(undefined, "debug")).toBe("debug");
  });

  it("identifies debug-capable modes", () => {
    expect(isDebugMode("normal")).toBe(false);
    expect(isDebugMode("debug")).toBe(true);
  });

  it("starts debug mode paused", () => {
    expect(createBootSession("debug").paused).toBe(true);
    expect(createBootSession("normal").paused).toBe(false);
  });

  it("uses time-derived seed only for normal mode", () => {
    expect(resolveBootSeed("normal", 123456789)).toBe(123456789);
    expect(resolveBootSeed("debug", 123456789)).toBe(7);
  });

  it("boots normal with standard conditions", () => {
    const session = createBootSession("normal", 123);

    expect(session.state.pieceCount).toBe(0);
    expect(session.state.gravityInternal).toBeGreaterThan(0);
    expect(session.state.gravityInternal).toBeLessThan(5120);
    expect(session.paused).toBe(false);
  });

  it("exports the Vite env key used for boot mode", () => {
    expect(BOOT_MODE_ENV_KEY).toBe("VITE_BOOT_MODE");
  });
});
