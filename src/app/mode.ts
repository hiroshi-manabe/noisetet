import { createInitialGameState, type GameState } from "../core/index.js";

export const BOOT_MODE_STORAGE_KEY = "noisetet:mode";
export const BOOT_MODE_ENV_KEY = "VITE_BOOT_MODE";

export type BootMode = "normal" | "debug";

export interface BootSession {
  mode: BootMode;
  paused: boolean;
  state: GameState;
}

function parseBootMode(rawValue: string | null | undefined): BootMode | null {
  if (rawValue === "normal" || rawValue === "debug") {
    return rawValue;
  }

  return null;
}

export function resolveBootMode(rawValue: string | null | undefined): BootMode {
  return parseBootMode(rawValue) ?? "normal";
}

export function resolveBootModeFromSources(
  envValue: string | undefined,
  storageValue: string | null,
): BootMode {
  return parseBootMode(envValue) ?? parseBootMode(storageValue) ?? "normal";
}

export function isDebugMode(mode: BootMode): boolean {
  return mode !== "normal";
}

export function resolveBootSeed(mode: BootMode, timeMs = Date.now()): number {
  if (mode === "normal") {
    return (Math.floor(timeMs) >>> 0) || 1;
  }

  return 7;
}

export function createBootSession(mode: BootMode, seed = resolveBootSeed(mode)): BootSession {
  switch (mode) {
    case "debug":
      return {
        mode,
        paused: true,
        state: createInitialGameState({ seed }),
      };
    case "normal":
    default:
      return {
        mode: "normal",
        paused: false,
        state: createInitialGameState({ seed }),
      };
  }
}
