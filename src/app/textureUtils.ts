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
    base: number;
    spread: number;
    alpha?: number;
  },
): void {
  const random = createSeededRandom(seed);
  const image = context.createImageData(width, height);
  const alpha = clampByte((options.alpha ?? 1) * 255);

  for (let index = 0; index < image.data.length; index += 4) {
    const sample = options.base + (random() * 2 - 1) * options.spread;
    const value = clampByte(sample);
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = alpha;
  }

  context.putImageData(image, 0, 0);
}
