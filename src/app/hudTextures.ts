const DIGIT_WIDTH = 22;
const DIGIT_HEIGHT = 32;

function createTextureCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

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

function createLabelTexture(label: string): HTMLCanvasElement {
  const canvas = createTextureCanvas(94, 24);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable for HUD label texture.");
  }

  fillTexturedBackground(context, canvas.width, canvas.height, "rgba(212, 187, 99, 0.26)");
  context.fillStyle = "#eef1df";
  context.font = 'bold 14px "Iosevka Term", "SFMono-Regular", Menlo, Consolas, monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, Math.floor(canvas.height / 2) + 1);
  return canvas;
}

function createDigitTexture(digit: string): HTMLCanvasElement {
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

export function createHudTextures(): HudTextures {
  const digits: Record<string, HTMLCanvasElement> = {};
  for (const digit of "0123456789") {
    digits[digit] = createDigitTexture(digit);
  }

  return {
    labels: {
      score: createLabelTexture("SCORE"),
      pieces: createLabelTexture("PIECES"),
    },
    digits,
    digitWidth: DIGIT_WIDTH,
    digitHeight: DIGIT_HEIGHT,
  };
}
