export function createTextureCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function fillNoiseTexture(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  options: {
    base?: number;
    spread?: number;
    alpha?: number;
    blockSizeCssPixels?: number;
    pixelsPerCssPixel?: number;
    binary?: boolean;
    whiteProbability?: number;
  },
): void {
  const random = createSeededRandom(seed);
  const image = context.createImageData(width, height);
  const alpha = clampByte((options.alpha ?? 1) * 255);
  const pixelsPerCssPixel = Math.max(1, options.pixelsPerCssPixel ?? 1);
  const blockSize = Math.max(
    1,
    Math.round((options.blockSizeCssPixels ?? 1) * pixelsPerCssPixel),
  );

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      const value = options.binary
        ? random() < (options.whiteProbability ?? 0.5)
          ? 255
          : 0
        : clampByte((options.base ?? 128) + (random() * 2 - 1) * (options.spread ?? 0));

      for (let blockY = 0; blockY < blockSize && y + blockY < height; blockY += 1) {
        for (let blockX = 0; blockX < blockSize && x + blockX < width; blockX += 1) {
          const pixelIndex = ((y + blockY) * width + (x + blockX)) * 4;
          image.data[pixelIndex] = value;
          image.data[pixelIndex + 1] = value;
          image.data[pixelIndex + 2] = value;
          image.data[pixelIndex + 3] = alpha;
        }
      }
    }
  }

  context.putImageData(image, 0, 0);
}
