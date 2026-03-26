/**
 * Procedural SFX engine for Wasteland Survivors.
 * All sounds generated with Web Audio API — no files needed.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.06, freqEnd?: number) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.03, hpFreq = 2000) {
  const ctx = getCtx();
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hpFreq;
  src.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  src.start();
}

export const Sound = {
  init() { getCtx(); },

  // Player shoots
  shoot() {
    playTone(600, 0.04, 'square', 0.005, 300);
  },

  // Enemy killed
  kill() {
    playTone(180, 0.08, 'square', 0.008, 60);
    playNoise(0.04, 0.003);
  },

  // Boss/miniboss killed
  bossKill() {
    playTone(120, 0.15, 'sawtooth', 0.012, 30);
    playNoise(0.1, 0.006);
    setTimeout(() => playTone(200, 0.1, 'square', 0.008), 100);
  },

  // Player takes damage
  hit() {
    playTone(80, 0.12, 'sawtooth', 0.015, 40);
    playNoise(0.08, 0.008, 1000);
  },

  // Level up
  levelUp() {
    playTone(400, 0.06, 'square', 0.008);
    setTimeout(() => playTone(600, 0.06, 'square', 0.008), 70);
    setTimeout(() => playTone(800, 0.08, 'square', 0.01), 140);
  },

  // Chest open
  chestOpen() {
    playTone(300, 0.05, 'triangle', 0.008);
    setTimeout(() => playTone(450, 0.05, 'triangle', 0.008), 60);
    setTimeout(() => playTone(600, 0.06, 'triangle', 0.01), 120);
    setTimeout(() => playTone(900, 0.08, 'triangle', 0.012), 200);
  },

  // Select upgrade
  select() {
    playTone(800, 0.03, 'square', 0.006);
    setTimeout(() => playTone(1000, 0.04, 'square', 0.006), 40);
  },

  // Dash skill
  dash() {
    playTone(500, 0.08, 'sawtooth', 0.008, 1200);
    playNoise(0.05, 0.004, 4000);
  },

  // Shockwave skill
  shockwave() {
    playTone(200, 0.2, 'sine', 0.015, 30);
    playNoise(0.15, 0.008, 500);
  },

  // Explosion (grenade, exploder death)
  explosion() {
    playTone(100, 0.2, 'sawtooth', 0.012, 20);
    playNoise(0.15, 0.01, 800);
  },

  // Game over
  gameOver() {
    playTone(300, 0.2, 'square', 0.012);
    setTimeout(() => playTone(220, 0.2, 'square', 0.012), 200);
    setTimeout(() => playTone(150, 0.3, 'square', 0.012), 400);
    setTimeout(() => playTone(80, 0.5, 'sawtooth', 0.015), 650);
  },

  // Victory
  victory() {
    playTone(400, 0.08, 'square', 0.01);
    setTimeout(() => playTone(500, 0.08, 'square', 0.01), 100);
    setTimeout(() => playTone(600, 0.08, 'square', 0.01), 200);
    setTimeout(() => playTone(800, 0.12, 'square', 0.012), 320);
    setTimeout(() => playTone(1000, 0.15, 'square', 0.012), 460);
  },

  // XP pickup
  xpPickup() {
    playTone(1200, 0.02, 'sine', 0.003, 1800);
  },

  // Heart pickup
  heartPickup() {
    playTone(600, 0.04, 'triangle', 0.006, 900);
    setTimeout(() => playTone(900, 0.04, 'triangle', 0.006), 40);
  },
};
