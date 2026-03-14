import { describe, expect, it } from "vitest";

import {
  getNextTheme,
  resolveRuntimeTheme,
  resolveTheme,
  resolveThemeFromSources,
  rotationToQuarterTurns,
} from "../src/app/theme.js";

describe("theme selection", () => {
  it("falls back to solid for unknown theme values", () => {
    expect(resolveTheme(null)).toBe("solid");
    expect(resolveTheme("mystery")).toBe("solid");
  });

  it("prefers env-configured theme over storage", () => {
    expect(resolveThemeFromSources("noise", "solid")).toBe("noise");
    expect(resolveThemeFromSources(undefined, "noise")).toBe("noise");
  });

  it("forces noise theme in normal mode", () => {
    expect(resolveRuntimeTheme("normal", "solid", "solid")).toBe("noise");
    expect(resolveRuntimeTheme("normal", undefined, null)).toBe("noise");
  });

  it("keeps theme overrides available in debug modes", () => {
    expect(resolveRuntimeTheme("debug", "solid", "noise")).toBe("solid");
    expect(resolveRuntimeTheme("debug20g", undefined, "noise")).toBe("noise");
  });

  it("accepts explicit theme names", () => {
    expect(resolveTheme("solid")).toBe("solid");
    expect(resolveTheme("noise")).toBe("noise");
  });

  it("toggles between solid and noise", () => {
    expect(getNextTheme("solid")).toBe("noise");
    expect(getNextTheme("noise")).toBe("solid");
  });

  it("converts rotations to quarter turns", () => {
    expect(rotationToQuarterTurns("spawn")).toBe(0);
    expect(rotationToQuarterTurns("right")).toBe(1);
    expect(rotationToQuarterTurns("reverse")).toBe(2);
    expect(rotationToQuarterTurns("left")).toBe(3);
  });
});
