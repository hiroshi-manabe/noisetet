import { createTextureCanvas, fillNoiseTexture, seedFromString } from "./textureUtils.js";

const DIGIT_WIDTH = 22;
const DIGIT_HEIGHT = 32;
const LABEL_HEIGHT = 32;
const LABEL_WIDTH = 110;

export type HudTextureMode = "solid" | "noise";

function fillTexturedBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
): void {
  context.fillStyle = "#12160f";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(212, 187, 99, 0.24)";
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, width - 1, height - 1);

  for (let x = 0; x < width; x += 4) {
    context.fillStyle = x % 8 === 0 ? "rgba(238, 241, 223, 0.08)" : "rgba(0, 0, 0, 0.18)";
    context.fillRect(x, 0, 2, height);
  }

  context.globalCompositeOperation = "screen";
  context.fillStyle = accent;
  context.fillRect(0, 0, width, Math.max(2, Math.floor(height * 0.12)));
  context.globalCompositeOperation = "source-over";
}

function createSolidLabelTexture(label: string): HTMLCanvasElement {
  const canvas = createTextureCanvas(LABEL_WIDTH, LABEL_HEIGHT);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for HUD label texture.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 24px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";

  const labelY = Math.floor(canvas.height / 2) + 1;
  context.fillStyle = "#eef1df";
  context.fillText(label, canvas.width / 2, labelY);

  context.globalCompositeOperation = "source-atop";
  for (let x = 0; x < canvas.width; x += 4) {
    context.fillStyle = x % 8 === 0 ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
    context.fillRect(x, 0, 2, canvas.height);
  }

  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  context.fillRect(0, 2, canvas.width, 3);

  context.globalCompositeOperation = "screen";
  context.fillStyle = "rgba(212, 187, 99, 0.22)";
  context.fillRect(0, 0, canvas.width, Math.max(3, Math.floor(canvas.height * 0.18)));

  context.globalCompositeOperation = "source-over";
  return canvas;
}

function createNoiseGlyphTexture(
  text: string,
  width: number,
  height: number,
  font: string,
  seedKey: string,
): HTMLCanvasElement {
  const canvas = createTextureCanvas(width, height);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for HUD glyph texture.");
  }

  context.clearRect(0, 0, width, height);
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#f2f5eb";
  context.fillText(text, width / 2, Math.floor(height / 2) + 1);

  context.globalCompositeOperation = "source-atop";
  fillNoiseTexture(context, width, height, seedFromString(seedKey), {
    base: 196,
    spread: 72,
  });
  context.fillStyle = "rgba(255, 255, 255, 0.12)";
  context.fillRect(0, 0, width, Math.max(2, Math.floor(height * 0.16)));
  context.globalCompositeOperation = "source-over";
  return canvas;
}

function createLabelTexture(label: string, mode: HudTextureMode): HTMLCanvasElement {
  if (mode === "noise") {
    return createNoiseGlyphTexture(
      label,
      LABEL_WIDTH,
      LABEL_HEIGHT,
      'bold 24px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace',
      `hud-label-${label}`,
    );
  }

  return createSolidLabelTexture(label);
}

function createDigitTexture(digit: string, mode: HudTextureMode): HTMLCanvasElement {
  if (mode === "noise") {
    return createNoiseGlyphTexture(
      digit,
      DIGIT_WIDTH,
      DIGIT_HEIGHT,
      'bold 24px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace',
      `hud-digit-${digit}`,
    );
  }

  const canvas = createTextureCanvas(DIGIT_WIDTH, DIGIT_HEIGHT);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for HUD digit texture.");
  }

  fillTexturedBackground(context, canvas.width, canvas.height, "rgba(111, 151, 237, 0.2)");
  context.fillStyle = "#eef1df";
  context.font = 'bold 24px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(digit, canvas.width / 2, Math.floor(canvas.height / 2) + 1);
  return canvas;
}

export interface HudTextures {
  labels: {
    score: HTMLCanvasElement;
    pieces: HTMLCanvasElement;
  };
  digits: Record<string, HTMLCanvasElement>;
  digitWidth: number;
  digitHeight: number;
}

export function createHudTextures(mode: HudTextureMode): HudTextures {
  const digits: Record<string, HTMLCanvasElement> = {};
  for (const digit of "0123456789") {
    digits[digit] = createDigitTexture(digit, mode);
  }

  return {
    labels: {
      score: createLabelTexture("SCORE", mode),
      pieces: createLabelTexture("PIECES", mode),
    },
    digits,
    digitWidth: DIGIT_WIDTH,
    digitHeight: DIGIT_HEIGHT,
  };
}
