import type { Rotation, Tetromino } from "../core/index.js";
import { createHudTextures, type HudTextures } from "./hudTextures.js";
import {
  createTextureCanvas,
  fillNoiseTexture,
  seedFromString,
} from "./textureUtils.js";

export const THEME_STORAGE_KEY = "noisetet:theme";
export const THEME_ENV_KEY = "VITE_THEME";

export type ThemeName = "solid" | "noise";

export interface TileMaterial {
  texture: HTMLCanvasElement;
  rotateWithPiece: boolean;
}

export interface AppTheme {
  name: ThemeName;
  displayName: string;
  backgroundTexture: HTMLCanvasElement;
  boardSurfaceTexture: HTMLCanvasElement;
  panelTexture: HTMLCanvasElement;
  previewBoxTexture: HTMLCanvasElement;
  frameTile: HTMLCanvasElement;
  hudTextures: HudTextures;
  gridStroke: string;
  panelStroke: string;
  previewBoxStroke: string;
  nextLabelColor: string;
  overlayFill: string;
  overlayText: string;
  overlayMuted: string;
  pieceMaterials: Record<Tetromino, TileMaterial>;
}

function parseThemeName(rawValue: string | null | undefined): ThemeName | null {
  if (rawValue === "solid" || rawValue === "noise") {
    return rawValue;
  }

  return null;
}

export function resolveTheme(rawValue: string | null | undefined): ThemeName {
  return parseThemeName(rawValue) ?? "solid";
}

export function resolveThemeFromSources(
  envValue: string | undefined,
  storageValue: string | null,
): ThemeName {
  return parseThemeName(envValue) ?? parseThemeName(storageValue) ?? "solid";
}

function paintStripedTexture(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseFill: string,
  accentFill: string,
): void {
  context.fillStyle = baseFill;
  context.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 4) {
    context.fillStyle = x % 8 === 0 ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.12)";
    context.fillRect(x, 0, 2, height);
  }

  context.fillStyle = accentFill;
  context.fillRect(0, 0, width, Math.max(2, Math.floor(height * 0.16)));
}

function createSolidPieceTexture(size: number, color: string): HTMLCanvasElement {
  const canvas = createTextureCanvas(size, size);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for solid piece texture.");
  }

  paintStripedTexture(context, size, size, color, "rgba(255, 255, 255, 0.16)");
  context.strokeStyle = "rgba(255, 255, 255, 0.15)";
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, size - 1, size - 1);
  return canvas;
}

function createNoisePieceTexture(size: number, key: string, base = 182, spread = 72): HTMLCanvasElement {
  const canvas = createTextureCanvas(size, size);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for noise piece texture.");
  }

  fillNoiseTexture(context, size, size, seedFromString(key), { base, spread });
  context.strokeStyle = "rgba(255, 255, 255, 0.18)";
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, size - 1, size - 1);
  return canvas;
}

function createFrameTileTexture(size: number, theme: ThemeName): HTMLCanvasElement {
  const canvas = createTextureCanvas(size, size);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for frame texture.");
  }

  if (theme === "noise") {
    fillNoiseTexture(context, size, size, seedFromString("frame-noise"), { base: 150, spread: 88 });
    context.fillStyle = "rgba(255, 255, 255, 0.1)";
    context.fillRect(0, 0, size, Math.max(2, Math.floor(size * 0.18)));
  } else {
    paintStripedTexture(context, size, size, "#4f5943", "rgba(212, 187, 99, 0.3)");
  }

  context.strokeStyle = "rgba(238, 241, 223, 0.16)";
  context.lineWidth = 1;
  context.strokeRect(1.5, 1.5, size - 3, size - 3);
  context.strokeStyle = "rgba(0, 0, 0, 0.3)";
  context.strokeRect(2.5, 2.5, size - 5, size - 5);
  return canvas;
}

function createSurfaceTexture(size: number, key: string, theme: ThemeName): HTMLCanvasElement {
  const canvas = createTextureCanvas(size, size);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for surface texture.");
  }

  if (theme === "noise") {
    fillNoiseTexture(context, size, size, seedFromString(key), { base: 42, spread: 14 });
  } else {
    paintStripedTexture(context, size, size, "#131710", "rgba(255, 255, 255, 0.04)");
  }

  return canvas;
}

function createPanelTexture(size: number, key: string, theme: ThemeName): HTMLCanvasElement {
  const canvas = createTextureCanvas(size, size);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for panel texture.");
  }

  if (theme === "noise") {
    fillNoiseTexture(context, size, size, seedFromString(key), { base: 72, spread: 30 });
  } else {
    paintStripedTexture(context, size, size, "#192017", "rgba(212, 187, 99, 0.12)");
  }

  return canvas;
}

function createBackgroundTexture(size: number, theme: ThemeName): HTMLCanvasElement {
  const canvas = createTextureCanvas(size, size);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for background texture.");
  }

  if (theme === "noise") {
    fillNoiseTexture(context, size, size, seedFromString("background-noise"), { base: 28, spread: 18 });
  } else {
    paintStripedTexture(context, size, size, "#10120e", "rgba(255, 255, 255, 0.02)");
  }

  return canvas;
}

function createSolidTheme(cellSize: number): AppTheme {
  const solidColors: Record<Tetromino, string> = {
    I: "#77f0e3",
    O: "#f3dc6b",
    T: "#cc91f5",
    S: "#92d56f",
    Z: "#f17e78",
    J: "#6f97ed",
    L: "#f2ae5b",
  };

  return {
    name: "solid",
    displayName: "Solid Theme",
    backgroundTexture: createBackgroundTexture(32, "solid"),
    boardSurfaceTexture: createSurfaceTexture(cellSize, "solid-board", "solid"),
    panelTexture: createPanelTexture(cellSize, "solid-panel", "solid"),
    previewBoxTexture: createSurfaceTexture(cellSize, "solid-preview", "solid"),
    frameTile: createFrameTileTexture(cellSize, "solid"),
    hudTextures: createHudTextures("solid"),
    gridStroke: "rgba(238, 241, 223, 0.06)",
    panelStroke: "#4a5540",
    previewBoxStroke: "rgba(238, 241, 223, 0.12)",
    nextLabelColor: "#d4bb63",
    overlayFill: "rgba(0, 0, 0, 0.65)",
    overlayText: "#eef1df",
    overlayMuted: "#a9b09b",
    pieceMaterials: {
      I: { texture: createSolidPieceTexture(cellSize, solidColors.I), rotateWithPiece: true },
      O: { texture: createSolidPieceTexture(cellSize, solidColors.O), rotateWithPiece: false },
      T: { texture: createSolidPieceTexture(cellSize, solidColors.T), rotateWithPiece: true },
      S: { texture: createSolidPieceTexture(cellSize, solidColors.S), rotateWithPiece: true },
      Z: { texture: createSolidPieceTexture(cellSize, solidColors.Z), rotateWithPiece: true },
      J: { texture: createSolidPieceTexture(cellSize, solidColors.J), rotateWithPiece: true },
      L: { texture: createSolidPieceTexture(cellSize, solidColors.L), rotateWithPiece: true },
    },
  };
}

function createNoiseTheme(cellSize: number): AppTheme {
  const pieceTypes: Tetromino[] = ["I", "O", "T", "S", "Z", "J", "L"];
  const pieceMaterials = Object.fromEntries(
    pieceTypes.map((type) => [
      type,
      {
        texture: createNoisePieceTexture(
          cellSize,
          `piece-${type}`,
          type === "O" ? 198 : 188 + (type.charCodeAt(0) % 9),
          78,
        ),
        rotateWithPiece: type !== "O",
      },
    ]),
  ) as Record<Tetromino, TileMaterial>;

  return {
    name: "noise",
    displayName: "Noise Theme",
    backgroundTexture: createBackgroundTexture(32, "noise"),
    boardSurfaceTexture: createSurfaceTexture(cellSize, "noise-board", "noise"),
    panelTexture: createPanelTexture(cellSize, "noise-panel", "noise"),
    previewBoxTexture: createSurfaceTexture(cellSize, "noise-preview", "noise"),
    frameTile: createFrameTileTexture(cellSize, "noise"),
    hudTextures: createHudTextures("noise"),
    gridStroke: "rgba(255, 255, 255, 0.05)",
    panelStroke: "rgba(238, 241, 223, 0.16)",
    previewBoxStroke: "rgba(238, 241, 223, 0.18)",
    nextLabelColor: "#d9ddd1",
    overlayFill: "rgba(0, 0, 0, 0.72)",
    overlayText: "#f0f3e8",
    overlayMuted: "#cfd4c3",
    pieceMaterials,
  };
}

export function createTheme(themeName: ThemeName, cellSize: number): AppTheme {
  return themeName === "noise" ? createNoiseTheme(cellSize) : createSolidTheme(cellSize);
}

export function rotationToQuarterTurns(rotation: Rotation): number {
  switch (rotation) {
    case "right":
      return 1;
    case "reverse":
      return 2;
    case "left":
      return 3;
    case "spawn":
    default:
      return 0;
  }
}
