import type { GameState } from "../core/types.js";

export interface AudioEvents {
  playImpact: boolean;
  playLineClear: boolean;
}

export interface GameAudio {
  unlock(): void;
  setEnabled(enabled: boolean): void;
  playImpact(): void;
  playLineClear(): void;
}

export function detectAudioEvents(
  previousState: Pick<GameState, "phase" | "activePiece">,
  currentState: Pick<GameState, "phase" | "activePiece">,
): AudioEvents {
  const groundedContact =
    currentState.activePiece !== null &&
    currentState.activePiece.grounded &&
    (previousState.activePiece === null || !previousState.activePiece.grounded);

  const airborneLockImpact =
    previousState.activePiece !== null &&
    !previousState.activePiece.grounded &&
    currentState.activePiece === null &&
    (currentState.phase === "ARE" || currentState.phase === "LineClear");

  return {
    playImpact: groundedContact || airborneLockImpact,
    playLineClear:
      previousState.phase !== "LineClear" && currentState.phase === "LineClear",
  };
}

function createNoiseBuffer(context: AudioContext, durationSeconds: number): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

export function createGameAudio(): GameAudio {
  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let masterCompressor: DynamicsCompressorNode | null = null;
  let makeupGain: GainNode | null = null;
  let impactNoiseBuffer: AudioBuffer | null = null;
  let lineNoiseBuffer: AudioBuffer | null = null;
  let enabled = true;

  function getContext(): AudioContext | null {
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
      return null;
    }

    if (context === null) {
      context = new window.AudioContext();
      masterCompressor = context.createDynamicsCompressor();
      masterCompressor.threshold.value = -30;
      masterCompressor.knee.value = 20;
      masterCompressor.ratio.value = 5;
      masterCompressor.attack.value = 0.002;
      masterCompressor.release.value = 0.22;
      makeupGain = context.createGain();
      makeupGain.gain.value = 1.8;
      masterGain = context.createGain();
      masterGain.gain.value = 1.2;
      masterGain.connect(masterCompressor);
      masterCompressor.connect(makeupGain);
      makeupGain.connect(context.destination);
    }

    return context;
  }

  function getMasterGain(): GainNode | null {
    const ctx = getContext();
    if (ctx === null) {
      return null;
    }

    return masterGain;
  }

  function getRunningContext(): AudioContext | null {
    const ctx = getContext();
    if (ctx === null) {
      return null;
    }

    if (ctx.state !== "running") {
      return null;
    }

    return ctx;
  }

  function getImpactNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (impactNoiseBuffer === null || impactNoiseBuffer.sampleRate !== ctx.sampleRate) {
      impactNoiseBuffer = createNoiseBuffer(ctx, 0.18);
    }

    return impactNoiseBuffer;
  }

  function getLineNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (lineNoiseBuffer === null || lineNoiseBuffer.sampleRate !== ctx.sampleRate) {
      lineNoiseBuffer = createNoiseBuffer(ctx, 0.24);
    }

    return lineNoiseBuffer;
  }

  return {
    unlock(): void {
      const ctx = getContext();
      if (ctx === null) {
        return;
      }

      void ctx.resume();
    },

    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
    },

    playImpact(): void {
      if (!enabled) {
        return;
      }

      const ctx = getRunningContext();
      const output = getMasterGain();
      if (ctx === null || output === null) {
        return;
      }

      const now = ctx.currentTime;

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = getImpactNoiseBuffer(ctx);

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(420, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.2);
      noiseFilter.Q.value = 0.65;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.34, now + 0.003);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      const thump = ctx.createOscillator();
      thump.type = "sine";
      thump.frequency.setValueAtTime(104, now);
      thump.frequency.exponentialRampToValueAtTime(42, now + 0.18);

      const thumpGain = ctx.createGain();
      thumpGain.gain.setValueAtTime(0.0001, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.46, now + 0.004);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(196, now);
      body.frequency.exponentialRampToValueAtTime(88, now + 0.14);

      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.14, now + 0.004);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(output);

      thump.connect(thumpGain);
      thumpGain.connect(output);

      body.connect(bodyGain);
      bodyGain.connect(output);

      noiseSource.start(now);
      noiseSource.stop(now + 0.2);
      thump.start(now);
      thump.stop(now + 0.19);
      body.start(now);
      body.stop(now + 0.14);
    },

    playLineClear(): void {
      if (!enabled) {
        return;
      }

      const ctx = getRunningContext();
      const output = getMasterGain();
      if (ctx === null || output === null) {
        return;
      }

      const now = ctx.currentTime;

      const tone = ctx.createOscillator();
      tone.type = "triangle";
      tone.frequency.setValueAtTime(1240, now);
      tone.frequency.exponentialRampToValueAtTime(760, now + 0.22);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.0001, now);
      toneGain.gain.exponentialRampToValueAtTime(0.28, now + 0.006);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

      const overtone = ctx.createOscillator();
      overtone.type = "sine";
      overtone.frequency.setValueAtTime(1880, now);
      overtone.frequency.exponentialRampToValueAtTime(1040, now + 0.2);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.0001, now);
      overtoneGain.gain.exponentialRampToValueAtTime(0.14, now + 0.004);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(360, now);
      sub.frequency.exponentialRampToValueAtTime(220, now + 0.18);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.exponentialRampToValueAtTime(0.1, now + 0.005);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      const sparkle = ctx.createBufferSource();
      sparkle.buffer = getLineNoiseBuffer(ctx);

      const sparkleFilter = ctx.createBiquadFilter();
      sparkleFilter.type = "bandpass";
      sparkleFilter.frequency.setValueAtTime(3000, now);
      sparkleFilter.Q.value = 0.9;

      const sparkleGain = ctx.createGain();
      sparkleGain.gain.setValueAtTime(0.0001, now);
      sparkleGain.gain.exponentialRampToValueAtTime(0.15, now + 0.004);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      tone.connect(toneGain);
      toneGain.connect(output);

      overtone.connect(overtoneGain);
      overtoneGain.connect(output);

      sub.connect(subGain);
      subGain.connect(output);

      sparkle.connect(sparkleFilter);
      sparkleFilter.connect(sparkleGain);
      sparkleGain.connect(output);

      tone.start(now);
      tone.stop(now + 0.26);
      overtone.start(now);
      overtone.stop(now + 0.22);
      sub.start(now);
      sub.stop(now + 0.2);
      sparkle.start(now);
      sparkle.stop(now + 0.2);
    },
  };
}
