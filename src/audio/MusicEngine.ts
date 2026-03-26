/**
 * Procedural keygen music engine — dark, oppressive, abyssal.
 * 10 tracks with varied moods: melancholic, aggressive, haunting.
 * All generated with Web Audio API oscillators.
 */

let ctx: AudioContext | null = null;
let playing = false;
let masterGain: GainNode | null = null;
let loopTimeout: number | null = null;
let currentTrack = 0;
let autoProgress = true; // auto-advance to next track after each loop

// ══════════════════════════════════════════════════════
// Core playback
// ══════════════════════════════════════════════════════

function ensureCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function playNote(freq: number, time: number, duration: number, type: OscillatorType, vol: number, detune = 0) {
  if (!ctx || !masterGain || freq <= 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  if (detune) osc.detune.setValueAtTime(detune, time);
  gain.gain.setValueAtTime(vol, time);
  gain.gain.setValueAtTime(vol, time + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.95);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(time);
  osc.stop(time + duration);
}

function playBass(freq: number, time: number, duration: number, vol = 0.1) {
  if (freq <= 0) return;
  playNote(freq, time, duration, 'sawtooth', vol);
  playNote(freq * 1.003, time, duration, 'sawtooth', vol * 0.5, 5);
}

function playLead(freq: number, time: number, duration: number, vol = 0.05) {
  if (!ctx || !masterGain || freq <= 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, time);
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(5, time);
  lfoGain.gain.setValueAtTime(6, time);
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  gain.gain.setValueAtTime(vol, time);
  gain.gain.setValueAtTime(vol, time + duration * 0.5);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.9);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(time);
  osc.stop(time + duration);
  lfo.start(time);
  lfo.stop(time + duration);
}

function playPad(freq: number, time: number, duration: number, vol = 0.03) {
  if (!ctx || !masterGain || freq <= 0) return;
  // Slow attack pad for atmosphere
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(vol, time + duration * 0.3);
  gain.gain.setValueAtTime(vol, time + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.98);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(time);
  osc.stop(time + duration);
  // Add detuned second voice
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 1.005, time);
  gain2.gain.setValueAtTime(0.001, time);
  gain2.gain.linearRampToValueAtTime(vol * 0.4, time + duration * 0.4);
  gain2.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.95);
  osc2.connect(gain2);
  gain2.connect(masterGain!);
  osc2.start(time);
  osc2.stop(time + duration);
}

function playKick(time: number, vol = 0.25) {
  if (!ctx || !masterGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(20, time + 0.12);
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(time);
  osc.stop(time + 0.15);
}

function playSnare(time: number, vol = 0.12) {
  if (!ctx || !masterGain) return;
  const bufSize = ctx.sampleRate * 0.06;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 3000;
  src.connect(f); f.connect(g); g.connect(masterGain!);
  src.start(time);
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, time);
  osc.frequency.exponentialRampToValueAtTime(100, time + 0.04);
  og.gain.setValueAtTime(vol * 0.8, time);
  og.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(og); og.connect(masterGain!);
  osc.start(time); osc.stop(time + 0.05);
}

function playHat(time: number, open = false, vol = 0.04) {
  if (!ctx || !masterGain) return;
  const dur = open ? 0.07 : 0.02;
  const bufSize = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = open ? 6000 : 9000;
  src.connect(f); f.connect(g); g.connect(masterGain!);
  src.start(time);
}

// ══════════════════════════════════════════════════════
// Track definitions — 10 dark keygen tracks
// ══════════════════════════════════════════════════════

// D minor notes: D=293.66 E=329.63 F=349.23 G=392 A=440 Bb=466.16 C=523.25
// Low octave: D2=73.4 E2=82.4 F2=87.3 G2=98 A2=110 Bb2=116.5 C3=130.8
// D3=146.8 D4=293.66 D5=587

interface Track {
  name: string;
  bpm: number;
  bass: number[];
  arp: number[];
  lead: number[];
  pad: number[];
  drums: number[]; // 0=none 1=kick 2=snare 3=hat 4=open hat
  // Volume overrides
  bassVol?: number;
  arpVol?: number;
  leadVol?: number;
  padVol?: number;
}

function dbl(a: number[]): number[] { return [...a, ...a]; }

// ── Track 1: DESCENT — Slow, heavy, oppressive ──
const T1: Track = {
  name: 'DESCENT', bpm: 75,
  bass: dbl([
    73.4, 0, 0, 0, 73.4, 0, 0, 73.4,
    58.3, 0, 0, 0, 58.3, 0, 0, 58.3,
    49.0, 0, 0, 0, 49.0, 0, 98.0, 0,
    55.0, 0, 0, 0, 110.0, 0, 55.0, 0,
  ]),
  arp: dbl([
    293, 0, 349, 0, 293, 0, 262, 0,
    233, 0, 293, 0, 233, 0, 175, 0,
    196, 0, 233, 0, 293, 0, 233, 0,
    220, 0, 262, 0, 220, 0, 175, 0,
  ]),
  lead: dbl([
    587, 0, 0, 523, 0, 0, 466, 0,
    0, 0, 440, 0, 0, 349, 0, 0,
    587, 0, 0, 0, 523, 0, 0, 466,
    0, 440, 0, 0, 0, 0, 0, 0,
  ]),
  pad: dbl([
    293, 293, 293, 293, 293, 293, 293, 293,
    233, 233, 233, 233, 233, 233, 233, 233,
    196, 196, 196, 196, 196, 196, 196, 196,
    220, 220, 220, 220, 220, 220, 220, 220,
  ]),
  drums: dbl([
    1, 0, 0, 0, 2, 0, 0, 0,
    1, 0, 0, 3, 2, 0, 0, 0,
    1, 0, 0, 0, 2, 0, 0, 3,
    1, 0, 3, 0, 2, 0, 3, 0,
  ]),
  bassVol: 0.12, leadVol: 0.04, padVol: 0.035,
};

// ── Track 2: VOID PULSE — Aggressive, fast, relentless ──
const T2: Track = {
  name: 'VOID PULSE', bpm: 140,
  bass: dbl([
    73.4, 0, 73.4, 0, 73.4, 146.8, 0, 73.4,
    58.3, 0, 58.3, 0, 58.3, 116.5, 0, 58.3,
    49.0, 0, 49.0, 98.0, 0, 49.0, 98.0, 0,
    55.0, 110.0, 55.0, 0, 110.0, 55.0, 110.0, 55.0,
  ]),
  arp: dbl([
    587, 698, 880, 587, 698, 880, 1175, 880,
    466, 587, 698, 466, 587, 698, 932, 698,
    392, 466, 587, 784, 587, 466, 392, 587,
    440, 554, 659, 880, 659, 554, 440, 659,
  ]),
  lead: dbl([
    1175, 0, 1047, 880, 0, 1175, 1318, 0,
    932, 0, 784, 698, 0, 932, 1047, 0,
    1175, 1318, 1175, 0, 880, 784, 880, 0,
    880, 0, 1047, 1175, 1318, 1175, 1047, 880,
  ]),
  pad: dbl([
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]),
  drums: dbl([
    1, 3, 3, 3, 2, 3, 1, 3,
    1, 3, 3, 1, 2, 3, 3, 3,
    1, 3, 1, 3, 2, 3, 1, 3,
    1, 3, 1, 3, 2, 4, 2, 4,
  ]),
  bassVol: 0.13, arpVol: 0.04,
};

// ── Track 3: ELEGY — Melancholic, slow, mourning ──
const T3: Track = {
  name: 'ELEGY', bpm: 65,
  bass: dbl([
    73.4, 0, 0, 0, 0, 0, 0, 0,
    87.3, 0, 0, 0, 0, 0, 0, 0,
    55.0, 0, 0, 0, 0, 0, 0, 0,
    65.4, 0, 0, 0, 0, 0, 0, 0,
  ]),
  arp: dbl([
    587, 0, 0, 698, 0, 0, 587, 0,
    698, 0, 0, 880, 0, 0, 698, 0,
    440, 0, 0, 523, 0, 0, 440, 0,
    523, 0, 0, 659, 0, 0, 523, 0,
  ]),
  lead: dbl([
    1175, 0, 0, 0, 1047, 0, 0, 0,
    1397, 0, 0, 0, 1175, 0, 0, 0,
    880, 0, 0, 0, 784, 0, 0, 0,
    1047, 0, 0, 0, 880, 0, 0, 0,
  ]),
  pad: dbl([
    293, 293, 293, 293, 293, 293, 293, 293,
    349, 349, 349, 349, 349, 349, 349, 349,
    220, 220, 220, 220, 220, 220, 220, 220,
    262, 262, 262, 262, 262, 262, 262, 262,
  ]),
  drums: dbl([
    1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 2, 0, 0, 0,
    1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 2, 0, 0, 3,
  ]),
  padVol: 0.04, leadVol: 0.035, bassVol: 0.08,
};

// ── Track 4: HUNT — Tense, stalking, predatory ──
const T4: Track = {
  name: 'HUNT', bpm: 100,
  bass: dbl([
    73.4, 0, 73.4, 0, 0, 73.4, 0, 0,
    73.4, 0, 73.4, 0, 0, 73.4, 146.8, 0,
    58.3, 0, 58.3, 0, 0, 58.3, 0, 0,
    58.3, 0, 58.3, 0, 116.5, 58.3, 116.5, 0,
  ]),
  arp: dbl([
    0, 293, 0, 293, 0, 349, 0, 0,
    0, 293, 0, 293, 0, 440, 0, 0,
    0, 233, 0, 233, 0, 293, 0, 0,
    0, 233, 0, 233, 0, 349, 0, 0,
  ]),
  lead: dbl([
    0, 0, 587, 0, 0, 0, 523, 0,
    0, 0, 587, 0, 0, 0, 698, 587,
    0, 0, 466, 0, 0, 0, 440, 0,
    0, 0, 466, 0, 0, 0, 523, 466,
  ]),
  pad: dbl([
    146, 146, 146, 146, 0, 0, 0, 0,
    146, 146, 146, 146, 0, 0, 0, 0,
    116, 116, 116, 116, 0, 0, 0, 0,
    116, 116, 116, 116, 0, 0, 0, 0,
  ]),
  drums: dbl([
    1, 0, 3, 0, 2, 0, 3, 0,
    1, 0, 3, 0, 2, 3, 0, 3,
    1, 0, 3, 0, 2, 0, 3, 0,
    1, 0, 3, 1, 2, 3, 2, 3,
  ]),
};

// ── Track 5: ABYSS — Drone-like, minimal, terrifying ──
const T5: Track = {
  name: 'ABYSS', bpm: 55,
  bass: dbl([
    36.7, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 36.7, 0, 0, 0,
    29.1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]),
  arp: dbl([
    0, 0, 293, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 262, 0,
    0, 0, 233, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]),
  lead: dbl([
    0, 0, 0, 0, 0, 0, 0, 587,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 466,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]),
  pad: dbl([
    73, 73, 73, 73, 73, 73, 73, 73,
    73, 73, 73, 73, 73, 73, 73, 73,
    58, 58, 58, 58, 58, 58, 58, 58,
    58, 58, 58, 58, 58, 58, 58, 58,
  ]),
  drums: dbl([
    1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]),
  bassVol: 0.15, padVol: 0.05, leadVol: 0.03, arpVol: 0.02,
};

// ── Track 6: WRATH — Fast, chaotic, violent ──
const T6: Track = {
  name: 'WRATH', bpm: 155,
  bass: dbl([
    73.4, 73.4, 146.8, 73.4, 146.8, 73.4, 146.8, 146.8,
    58.3, 58.3, 116.5, 58.3, 116.5, 58.3, 116.5, 116.5,
    49.0, 49.0, 98.0, 49.0, 98.0, 49.0, 98.0, 98.0,
    55.0, 55.0, 110.0, 55.0, 110.0, 110.0, 55.0, 110.0,
  ]),
  arp: dbl([
    587, 880, 587, 880, 1175, 880, 587, 1175,
    466, 698, 466, 698, 932, 698, 466, 932,
    392, 587, 392, 587, 784, 587, 392, 784,
    440, 659, 440, 659, 880, 659, 440, 880,
  ]),
  lead: dbl([
    1175, 1318, 1175, 880, 1175, 1318, 1760, 1318,
    932, 1047, 932, 698, 932, 1047, 1397, 1047,
    784, 932, 784, 587, 784, 932, 1175, 932,
    880, 1047, 880, 659, 880, 1047, 1318, 1047,
  ]),
  pad: dbl(new Array(32).fill(0)),
  drums: dbl([
    1, 3, 1, 3, 2, 3, 1, 3,
    1, 3, 1, 3, 2, 4, 1, 3,
    1, 3, 1, 3, 2, 3, 2, 3,
    1, 1, 2, 1, 2, 4, 2, 4,
  ]),
  bassVol: 0.14, arpVol: 0.05, leadVol: 0.06,
};

// ── Track 7: HOLLOW — Haunting, ethereal, ghostly ──
const T7: Track = {
  name: 'HOLLOW', bpm: 70,
  bass: dbl([
    55.0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    73.4, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]),
  arp: dbl([
    440, 0, 523, 0, 659, 0, 523, 0,
    440, 0, 349, 0, 293, 0, 349, 0,
    587, 0, 698, 0, 880, 0, 698, 0,
    587, 0, 466, 0, 392, 0, 466, 0,
  ]),
  lead: dbl([
    0, 0, 0, 0, 880, 0, 0, 0,
    0, 0, 0, 0, 698, 0, 0, 0,
    0, 0, 0, 0, 1175, 0, 0, 0,
    0, 0, 0, 0, 932, 0, 0, 0,
  ]),
  pad: dbl([
    220, 220, 220, 220, 220, 220, 220, 220,
    175, 175, 175, 175, 175, 175, 175, 175,
    293, 293, 293, 293, 293, 293, 293, 293,
    233, 233, 233, 233, 233, 233, 233, 233,
  ]),
  drums: dbl([
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 2, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 3,
  ]),
  padVol: 0.045, arpVol: 0.03, leadVol: 0.03, bassVol: 0.1,
};

// ── Track 8: DREAD — Industrial, grinding, mechanical ──
const T8: Track = {
  name: 'DREAD', bpm: 120,
  bass: dbl([
    73.4, 73.4, 0, 73.4, 0, 73.4, 73.4, 0,
    73.4, 73.4, 0, 73.4, 0, 146.8, 73.4, 0,
    58.3, 58.3, 0, 58.3, 0, 58.3, 58.3, 0,
    58.3, 58.3, 0, 58.3, 0, 116.5, 116.5, 58.3,
  ]),
  arp: dbl([
    587, 0, 587, 0, 698, 0, 587, 0,
    587, 0, 587, 0, 523, 0, 587, 0,
    466, 0, 466, 0, 587, 0, 466, 0,
    466, 0, 466, 0, 440, 0, 466, 0,
  ]),
  lead: dbl([
    0, 1175, 0, 0, 0, 1047, 0, 0,
    0, 1175, 0, 0, 0, 880, 0, 0,
    0, 932, 0, 0, 0, 880, 0, 0,
    0, 932, 0, 0, 0, 698, 0, 0,
  ]),
  pad: dbl(new Array(32).fill(0)),
  drums: dbl([
    1, 0, 1, 0, 2, 0, 0, 1,
    0, 1, 0, 0, 2, 0, 1, 0,
    1, 0, 1, 0, 2, 0, 0, 1,
    0, 1, 0, 1, 2, 2, 1, 2,
  ]),
  bassVol: 0.14, arpVol: 0.04, leadVol: 0.05,
};

// ── Track 9: REQUIEM — Grand, solemn, final ──
const T9: Track = {
  name: 'REQUIEM', bpm: 80,
  bass: dbl([
    73.4, 0, 0, 73.4, 0, 0, 146.8, 0,
    87.3, 0, 0, 87.3, 0, 0, 174.6, 0,
    55.0, 0, 0, 55.0, 0, 0, 110.0, 0,
    65.4, 0, 0, 65.4, 0, 0, 130.8, 0,
  ]),
  arp: dbl([
    293, 349, 440, 587, 440, 349, 293, 349,
    349, 440, 523, 698, 523, 440, 349, 440,
    220, 262, 330, 440, 330, 262, 220, 262,
    262, 330, 392, 523, 392, 330, 262, 330,
  ]),
  lead: dbl([
    587, 0, 0, 0, 698, 0, 880, 0,
    698, 0, 0, 0, 880, 0, 1047, 0,
    440, 0, 0, 0, 523, 0, 659, 0,
    523, 0, 0, 0, 659, 0, 784, 523,
  ]),
  pad: dbl([
    146, 146, 146, 146, 146, 146, 146, 146,
    175, 175, 175, 175, 175, 175, 175, 175,
    110, 110, 110, 110, 110, 110, 110, 110,
    131, 131, 131, 131, 131, 131, 131, 131,
  ]),
  drums: dbl([
    1, 0, 0, 3, 2, 0, 0, 0,
    1, 0, 0, 3, 2, 0, 0, 3,
    1, 0, 0, 3, 2, 0, 0, 0,
    1, 0, 3, 0, 2, 4, 0, 4,
  ]),
  padVol: 0.04, leadVol: 0.045,
};

// ── Track 10: OBLIVION — Epic, crescendo, final boss ──
const T10: Track = {
  name: 'OBLIVION', bpm: 130,
  bass: dbl([
    73.4, 146.8, 73.4, 146.8, 73.4, 0, 146.8, 0,
    87.3, 174.6, 87.3, 174.6, 87.3, 0, 174.6, 0,
    55.0, 110.0, 55.0, 110.0, 55.0, 0, 110.0, 0,
    58.3, 116.5, 58.3, 116.5, 58.3, 116.5, 58.3, 233.1,
  ]),
  arp: dbl([
    587, 698, 880, 1175, 1397, 1175, 880, 698,
    698, 880, 1047, 1397, 1760, 1397, 1047, 880,
    440, 523, 659, 880, 1047, 880, 659, 523,
    466, 587, 698, 932, 1175, 932, 698, 587,
  ]),
  lead: dbl([
    1175, 0, 1318, 1175, 0, 880, 1047, 1175,
    1397, 0, 1760, 1397, 0, 1047, 1175, 1397,
    880, 0, 1047, 880, 0, 659, 784, 880,
    932, 0, 1175, 932, 0, 698, 784, 932,
  ]),
  pad: dbl([
    293, 293, 293, 293, 0, 0, 0, 0,
    349, 349, 349, 349, 0, 0, 0, 0,
    220, 220, 220, 220, 0, 0, 0, 0,
    233, 233, 233, 233, 0, 0, 0, 0,
  ]),
  drums: dbl([
    1, 3, 1, 3, 2, 3, 1, 3,
    1, 3, 1, 3, 2, 3, 3, 3,
    1, 3, 1, 3, 2, 3, 1, 3,
    1, 1, 1, 1, 2, 4, 2, 4,
  ]),
  bassVol: 0.14, arpVol: 0.05, leadVol: 0.06, padVol: 0.03,
};

// Ordered by intensity: calm → oppressive → aggressive → epic
const TRACKS: Track[] = [T5, T3, T7, T1, T4, T9, T8, T2, T6, T10];
// ABYSS(55) → ELEGY(65) → HOLLOW(70) → DESCENT(75) → HUNT(100) → REQUIEM(80) → DREAD(120) → VOID PULSE(140) → WRATH(155) → OBLIVION(130)

// ══════════════════════════════════════════════════════
// Playback
// ══════════════════════════════════════════════════════

let nextLoopTime = 0;
let trackStartTime = 0; // when the current track started
const TRACK_DURATION = 90; // seconds per track (10 tracks × 90s = 900s = 15 min)

function scheduleTrack(track: Track, startTime: number) {
  const step = 60 / track.bpm / 4;
  const len = track.bass.length;

  const bv = track.bassVol ?? 0.1;
  const av = track.arpVol ?? 0.035;
  const lv = track.leadVol ?? 0.04;
  const pv = track.padVol ?? 0;

  for (let i = 0; i < len; i++) {
    const t = startTime + i * step;
    if (track.bass[i] > 0) playBass(track.bass[i], t, step * 1.8, bv);
    if (track.arp[i] > 0) playNote(track.arp[i], t, step * 0.5, 'square', av);
    if (track.lead[i] > 0) playLead(track.lead[i], t, step * 0.75, lv);
    if (track.pad[i] > 0 && (i % 4 === 0)) playPad(track.pad[i], t, step * 4, pv);

    const drum = track.drums[i];
    if (drum === 1) playKick(t);
    if (drum === 2) playSnare(t);
    if (drum === 3) playHat(t);
    if (drum === 4) playHat(t, true);
  }

  const loopDuration = len * step;
  nextLoopTime = startTime + loopDuration;

  const audioCtx = ensureCtx();
  const msUntilNext = (nextLoopTime - audioCtx.currentTime - 0.5) * 1000;
  loopTimeout = window.setTimeout(() => {
    if (!playing) return;
    // Check if 90s elapsed on this track → advance
    const elapsed = audioCtx.currentTime - trackStartTime;
    if (autoProgress && elapsed >= TRACK_DURATION && currentTrack < TRACKS.length - 1) {
      currentTrack++;
      trackStartTime = audioCtx.currentTime;
    }
    scheduleTrack(TRACKS[currentTrack], nextLoopTime);
  }, Math.max(0, msUntilNext));
}

export const Music = {
  start() {
    if (playing) return;
    playing = true;
    trackStartTime = ensureCtx().currentTime;
    const audioCtx = ensureCtx();
    scheduleTrack(TRACKS[currentTrack], audioCtx.currentTime + 0.05);
  },

  stop() {
    playing = false;
    if (loopTimeout !== null) { clearTimeout(loopTimeout); loopTimeout = null; }
  },

  toggle() {
    if (playing) Music.stop(); else Music.start();
  },

  isPlaying() { return playing; },

  setVolume(vol: number) {
    if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, vol));
  },

  /** Switch to a specific track (0-9). Takes effect at next loop boundary. */
  setTrack(index: number) {
    currentTrack = Math.max(0, Math.min(TRACKS.length - 1, index));
    if (ctx) trackStartTime = ctx.currentTime;
  },

  /** Switch to next track */
  nextTrack() {
    currentTrack = (currentTrack + 1) % TRACKS.length;
  },

  /** Get current track name */
  getTrackName(): string {
    return TRACKS[currentTrack].name;
  },

  getTrackIndex(): number { return currentTrack; },
  getTrackCount(): number { return TRACKS.length; },
};
