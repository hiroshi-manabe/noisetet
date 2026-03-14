import type { Rotation, Tetromino } from "../core/index.js";
import { createHudTextures, type HudTextures } from "./hudTextures.js";
import {
  createTextureCanvas,
  fillNoiseTexture,
  seedFromString,
} from "./textureUtils.js";

export const THEME_STORAGE_KEY = "noisetet:theme";
export const THEME_ENV_KEY = "VITE_THEME";
const NOISE_BLOCK_CSS_PIXELS = 1;
const TEXTURE_PIXELS_PER_CSS_PIXEL = 1;

export type ThemeName = "solid" | "noise";

export interface ThemeDimensions {
  canvasWidth: number;
  canvasHeight: number;
  boardWidth: number;
  boardHeight: number;
  frameOuterWidth: number;
  frameOuterHeight: number;
  previewPanelWidth: number;
  previewPanelHeight: number;
  previewBoxSize: number;
  hudPanelWidth: number;
  hudPanelHeight: number;
  frameThickness: number;
}

export interface TileMaterial {
  textures: readonly HTMLCanvasElement[];
  rotateWithPiece: boolean;
}

export interface AppTheme {
  name: ThemeName;
  displayName: string;
  backgroundTexture: HTMLCanvasElement;
  boardSurfaceTexture: HTMLCanvasElement;
  previewPanelSurface: HTMLCanvasElement;
  previewBoxSurface: HTMLCanvasElement;
  hudPanelSurface: HTMLCanvasElement;
  frameSurface: HTMLCanvasElement;
  hudTextures: HudTextures;
  gridStroke: string;
  panelStroke: string;
  previewBoxStroke: string;
  nextLabelColor: string;
  overlayFill: string;
  overlayText: string;
  overlayMuted: string;
  showNextLabel: boolean;
  showPreviewPanelChrome: boolean;
  showPreviewBoxChrome: boolean;
  showHudPanelChrome: boolean;
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

export function resolveRuntimeTheme(
  mode: "normal" | "debug" | "debug20g",
  envValue: string | undefined,
  storageValue: string | null,
): ThemeName {
  if (mode === "normal") {
    return "noise";
  }

  return resolveThemeFromSources(envValue, storageValue);
}

export function getNextTheme(themeName: ThemeName): ThemeName {
  return themeName === "solid" ? "noise" : "solid";
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

function createStripedSurface(width: number, height: number, baseFill: string, accentFill: string): HTMLCanvasElement {
  const canvas = createTextureCanvas(width, height);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for striped surface.");
  }

  paintStripedTexture(context, width, height, baseFill, accentFill);
  return canvas;
}

function createNoiseSurface(width: number, height: number, key: string, base = 132, spread = 56): HTMLCanvasElement {
  const canvas = createTextureCanvas(width, height);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for noise surface.");
  }

  fillNoiseTexture(context, width, height, seedFromString(key), {
    binary: true,
    whiteProbability: 0.5,
    blockSizeCssPixels: NOISE_BLOCK_CSS_PIXELS,
    pixelsPerCssPixel: TEXTURE_PIXELS_PER_CSS_PIXEL,
  });
  return canvas;
}

function rotateSquareCanvas(source: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const normalizedTurns = ((quarterTurns % 4) + 4) % 4;
  if (normalizedTurns === 0) {
    return source;
  }

  const canvas = createTextureCanvas(source.width, source.height);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for rotated surface.");
  }

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((Math.PI / 2) * normalizedTurns);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function createPieceSurfaceVariants(
  baseSurface: HTMLCanvasElement,
  rotateWithPiece: boolean,
): readonly HTMLCanvasElement[] {
  if (!rotateWithPiece) {
    return [baseSurface, baseSurface, baseSurface, baseSurface];
  }

  return [
    baseSurface,
    rotateSquareCanvas(baseSurface, 1),
    rotateSquareCanvas(baseSurface, 2),
    rotateSquareCanvas(baseSurface, 3),
  ];
}

function createSolidPieceTexture(size: number, color: string): HTMLCanvasElement {
  const canvas = createTextureCanvas(size * 4, size * 4);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for solid piece texture.");
  }

  paintStripedTexture(context, canvas.width, canvas.height, color, "rgba(255, 255, 255, 0.16)");
  context.strokeStyle = "rgba(255, 255, 255, 0.15)";
  context.lineWidth = 1;
  return canvas;
}

function createNoisePieceTexture(size: number, key: string): HTMLCanvasElement {
  const canvas = createTextureCanvas(size * 4, size * 4);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for noise piece texture.");
  }

  fillNoiseTexture(context, canvas.width, canvas.height, seedFromString(key), {
    binary: true,
    whiteProbability: 0.5,
    blockSizeCssPixels: NOISE_BLOCK_CSS_PIXELS,
    pixelsPerCssPixel: TEXTURE_PIXELS_PER_CSS_PIXEL,
  });
  return canvas;
}

function createSolidFrameSurface(dimensions: ThemeDimensions): HTMLCanvasElement {
  const canvas = createTextureCanvas(dimensions.frameOuterWidth, dimensions.frameOuterHeight);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for solid frame surface.");
  }

  paintStripedTexture(
    context,
    canvas.width,
    canvas.height,
    "#4f5943",
    "rgba(212, 187, 99, 0.3)",
  );
  context.clearRect(
    dimensions.frameThickness,
    dimensions.frameThickness,
    canvas.width - dimensions.frameThickness * 2,
    canvas.height - dimensions.frameThickness * 2,
  );
  return canvas;
}

function createNoiseFrameSurface(dimensions: ThemeDimensions): HTMLCanvasElement {
  const canvas = createTextureCanvas(dimensions.frameOuterWidth, dimensions.frameOuterHeight);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for noise frame surface.");
  }

  fillNoiseTexture(context, canvas.width, canvas.height, seedFromString("frame-noise"), {
    binary: true,
    whiteProbability: 0.5,
    blockSizeCssPixels: NOISE_BLOCK_CSS_PIXELS,
    pixelsPerCssPixel: TEXTURE_PIXELS_PER_CSS_PIXEL,
  });
  context.clearRect(
    dimensions.frameThickness,
    dimensions.frameThickness,
    canvas.width - dimensions.frameThickness * 2,
    canvas.height - dimensions.frameThickness * 2,
  );
  return canvas;
}

function createSolidTheme(dimensions: ThemeDimensions): AppTheme {
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
    backgroundTexture: createStripedSurface(
      dimensions.canvasWidth,
      dimensions.canvasHeight,
      "#10120e",
      "rgba(255, 255, 255, 0.02)",
    ),
    boardSurfaceTexture: createStripedSurface(
      dimensions.boardWidth,
      dimensions.boardHeight,
      "#131710",
      "rgba(255, 255, 255, 0.04)",
    ),
    previewPanelSurface: createStripedSurface(
      dimensions.previewPanelWidth,
      dimensions.previewPanelHeight,
      "#192017",
      "rgba(212, 187, 99, 0.12)",
    ),
    previewBoxSurface: createStripedSurface(
      dimensions.previewBoxSize,
      dimensions.previewBoxSize,
      "#0f130f",
      "rgba(255, 255, 255, 0.04)",
    ),
    hudPanelSurface: createStripedSurface(
      dimensions.hudPanelWidth,
      dimensions.hudPanelHeight,
      "#192017",
      "rgba(212, 187, 99, 0.12)",
    ),
    frameSurface: createSolidFrameSurface(dimensions),
    hudTextures: createHudTextures("solid"),
    gridStroke: "rgba(238, 241, 223, 0.06)",
    panelStroke: "#4a5540",
    previewBoxStroke: "rgba(238, 241, 223, 0.12)",
    nextLabelColor: "#d4bb63",
    overlayFill: "rgba(0, 0, 0, 0.65)",
    overlayText: "#eef1df",
    overlayMuted: "#a9b09b",
    showNextLabel: true,
    showPreviewPanelChrome: true,
    showPreviewBoxChrome: true,
    showHudPanelChrome: true,
    pieceMaterials: {
      I: {
        textures: createPieceSurfaceVariants(
          createSolidPieceTexture(dimensions.frameThickness, solidColors.I),
          true,
        ),
        rotateWithPiece: true,
      },
      O: {
        textures: createPieceSurfaceVariants(
          createSolidPieceTexture(dimensions.frameThickness, solidColors.O),
          false,
        ),
        rotateWithPiece: false,
      },
      T: {
        textures: createPieceSurfaceVariants(
          createSolidPieceTexture(dimensions.frameThickness, solidColors.T),
          true,
        ),
        rotateWithPiece: true,
      },
      S: {
        textures: createPieceSurfaceVariants(
          createSolidPieceTexture(dimensions.frameThickness, solidColors.S),
          true,
        ),
        rotateWithPiece: true,
      },
      Z: {
        textures: createPieceSurfaceVariants(
          createSolidPieceTexture(dimensions.frameThickness, solidColors.Z),
          true,
        ),
        rotateWithPiece: true,
      },
      J: {
        textures: createPieceSurfaceVariants(
          createSolidPieceTexture(dimensions.frameThickness, solidColors.J),
          true,
        ),
        rotateWithPiece: true,
      },
      L: {
        textures: createPieceSurfaceVariants(
          createSolidPieceTexture(dimensions.frameThickness, solidColors.L),
          true,
        ),
        rotateWithPiece: true,
      },
    },
  };
}

function createNoiseTheme(dimensions: ThemeDimensions): AppTheme {
  const pieceTypes: Tetromino[] = ["I", "O", "T", "S", "Z", "J", "L"];
  const pieceMaterials = Object.fromEntries(
    pieceTypes.map((type) => [
      type,
      {
        textures: createPieceSurfaceVariants(
          createNoisePieceTexture(dimensions.frameThickness, `piece-${type}`),
          type !== "O",
        ),
        rotateWithPiece: type !== "O",
      },
    ]),
  ) as Record<Tetromino, TileMaterial>;

  return {
    name: "noise",
    displayName: "Noise Theme",
    backgroundTexture: createNoiseSurface(
      dimensions.canvasWidth,
      dimensions.canvasHeight,
      "background-noise",
    ),
    boardSurfaceTexture: createNoiseSurface(
      dimensions.boardWidth,
      dimensions.boardHeight,
      "board-noise",
    ),
    previewPanelSurface: createNoiseSurface(
      dimensions.previewPanelWidth,
      dimensions.previewPanelHeight,
      "preview-panel-noise",
    ),
    previewBoxSurface: createNoiseSurface(
      dimensions.previewBoxSize,
      dimensions.previewBoxSize,
      "preview-box-noise",
    ),
    hudPanelSurface: createNoiseSurface(
      dimensions.hudPanelWidth,
      dimensions.hudPanelHeight,
      "hud-panel-noise",
    ),
    frameSurface: createNoiseFrameSurface(dimensions),
    hudTextures: createHudTextures("noise"),
    gridStroke: "rgba(255, 255, 255, 0)",
    panelStroke: "rgba(255, 255, 255, 0)",
    previewBoxStroke: "rgba(255, 255, 255, 0)",
    nextLabelColor: "rgba(255, 255, 255, 0)",
    overlayFill: "rgba(0, 0, 0, 0)",
    overlayText: "#f0f3e8",
    overlayMuted: "#cfd4c3",
    showNextLabel: false,
    showPreviewPanelChrome: false,
    showPreviewBoxChrome: false,
    showHudPanelChrome: false,
    pieceMaterials,
  };
}

export function createTheme(themeName: ThemeName, dimensions: ThemeDimensions): AppTheme {
  return themeName === "noise" ? createNoiseTheme(dimensions) : createSolidTheme(dimensions);
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
