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
      masterCompressor.threshold.value = -22;
      masterCompressor.knee.value = 18;
      masterCompressor.ratio.value = 3;
      masterCompressor.attack.value = 0.003;
      masterCompressor.release.value = 0.16;
      masterGain = context.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(masterCompressor);
      masterCompressor.connect(context.destination);
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
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(560, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(170, now + 0.16);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.32, now + 0.003);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      const thump = ctx.createOscillator();
      thump.type = "sine";
      thump.frequency.setValueAtTime(110, now);
      thump.frequency.exponentialRampToValueAtTime(52, now + 0.14);

      const thumpGain = ctx.createGain();
      thumpGain.gain.setValueAtTime(0.0001, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.2, now + 0.004);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(output);

      thump.connect(thumpGain);
      thumpGain.connect(output);

      noiseSource.start(now);
      noiseSource.stop(now + 0.16);
      thump.start(now);
      thump.stop(now + 0.14);
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
      tone.frequency.setValueAtTime(980, now);
      tone.frequency.exponentialRampToValueAtTime(620, now + 0.2);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.0001, now);
      toneGain.gain.exponentialRampToValueAtTime(0.18, now + 0.008);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      const overtone = ctx.createOscillator();
      overtone.type = "sine";
      overtone.frequency.setValueAtTime(1480, now);
      overtone.frequency.exponentialRampToValueAtTime(860, now + 0.18);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.0001, now);
      overtoneGain.gain.exponentialRampToValueAtTime(0.08, now + 0.006);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      const sparkle = ctx.createBufferSource();
      sparkle.buffer = getLineNoiseBuffer(ctx);

      const sparkleFilter = ctx.createBiquadFilter();
      sparkleFilter.type = "bandpass";
      sparkleFilter.frequency.setValueAtTime(2400, now);
      sparkleFilter.Q.value = 0.8;

      const sparkleGain = ctx.createGain();
      sparkleGain.gain.setValueAtTime(0.0001, now);
      sparkleGain.gain.exponentialRampToValueAtTime(0.09, now + 0.006);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      tone.connect(toneGain);
      toneGain.connect(output);

      overtone.connect(overtoneGain);
      overtoneGain.connect(output);

      sparkle.connect(sparkleFilter);
      sparkleFilter.connect(sparkleGain);
      sparkleGain.connect(output);

      tone.start(now);
      tone.stop(now + 0.24);
      overtone.start(now);
      overtone.stop(now + 0.18);
      sparkle.start(now);
      sparkle.stop(now + 0.19);
    },
  };
}
