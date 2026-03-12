import { createInitialGameState, type GameState } from "../core/index.js";

export const BOOT_MODE_STORAGE_KEY = "noisetet:mode";

export type BootMode = "normal" | "debug" | "debug20g";

export interface BootSession {
  mode: BootMode;
  paused: boolean;
  state: GameState;
}

export function resolveBootMode(rawValue: string | null): BootMode {
  if (rawValue === "debug" || rawValue === "debug20g") {
    return rawValue;
  }

  return "normal";
}

export function isDebugMode(mode: BootMode): boolean {
  return mode !== "normal";
}

export function createBootSession(mode: BootMode, seed = 7): BootSession {
  switch (mode) {
    case "debug":
      return {
        mode,
        paused: true,
        state: createInitialGameState({ seed }),
      };
    case "debug20g":
      return {
        mode,
        paused: true,
        state: createInitialGameState({ seed, pieceCount: 500 }),
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
