import type { GameState } from "../core/types.js";

export interface AudioEvents {
  playImpact: boolean;
  playLineClear: boolean;
}

export interface GameAudio {
  unlock(): void;
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
  let impactNoiseBuffer: AudioBuffer | null = null;
  let lineNoiseBuffer: AudioBuffer | null = null;

  function getContext(): AudioContext | null {
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
      return null;
    }

    if (context === null) {
      context = new window.AudioContext();
      masterGain = context.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(context.destination);
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

    playImpact(): void {
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
      noiseFilter.frequency.setValueAtTime(420, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(140, now + 0.12);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.22, now + 0.003);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      const thump = ctx.createOscillator();
      thump.type = "sine";
      thump.frequency.setValueAtTime(90, now);
      thump.frequency.exponentialRampToValueAtTime(46, now + 0.11);

      const thumpGain = ctx.createGain();
      thumpGain.gain.setValueAtTime(0.0001, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.14, now + 0.004);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(output);

      thump.connect(thumpGain);
      thumpGain.connect(output);

      noiseSource.start(now);
      noiseSource.stop(now + 0.13);
      thump.start(now);
      thump.stop(now + 0.11);
    },

    playLineClear(): void {
      const ctx = getRunningContext();
      const output = getMasterGain();
      if (ctx === null || output === null) {
        return;
      }

      const now = ctx.currentTime;

      const tone = ctx.createOscillator();
      tone.type = "triangle";
      tone.frequency.setValueAtTime(760, now);
      tone.frequency.exponentialRampToValueAtTime(520, now + 0.16);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.0001, now);
      toneGain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      const sparkle = ctx.createBufferSource();
      sparkle.buffer = getLineNoiseBuffer(ctx);

      const sparkleFilter = ctx.createBiquadFilter();
      sparkleFilter.type = "bandpass";
      sparkleFilter.frequency.setValueAtTime(1800, now);
      sparkleFilter.Q.value = 0.7;

      const sparkleGain = ctx.createGain();
      sparkleGain.gain.setValueAtTime(0.0001, now);
      sparkleGain.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      tone.connect(toneGain);
      toneGain.connect(output);

      sparkle.connect(sparkleFilter);
      sparkleFilter.connect(sparkleGain);
      sparkleGain.connect(output);

      tone.start(now);
      tone.stop(now + 0.19);
      sparkle.start(now);
      sparkle.stop(now + 0.15);
    },
  };
}
