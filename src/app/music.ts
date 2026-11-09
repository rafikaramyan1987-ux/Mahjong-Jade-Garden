/**
 * Background music, composed for this game and synthesized at runtime (Web Audio, no samples, no third-party music).
 * Two light, warm tracks in major pentatonic keys that alternate:
 * - "Morning Tea" (C major pentatonic, 96 bpm): soft flute melody, guzheng arpeggios, woodblock and hand drum
 * - "Lantern Walk" (G major pentatonic, 108 bpm): playful pipa melody, flute answers, guzheng, light percussion
 * Each track is a 16-bar loop (the melody once on its lead instrument, then varied on the other), so it repeats
 * seamlessly; the player alternates the tracks every two loops.
 */

export type Inst = 'flute' | 'pipa' | 'zheng' | 'bass' | 'block' | 'drum' | 'shaker';

export interface Note {
  /** start, in beats from the bar start */
  t: number;
  inst: Inst;
  midi: number;
  /** length in beats */
  dur: number;
  vel: number;
}

export interface Track {
  name: string;
  bpm: number;
  bars: number;
  bar(i: number): Note[];
}

type Mel = [number, number, number][]; // [beat, midi, beats]

/** the notes of a pentatonic scale over five octaves */
function ladderOf(scale: number[]): number[] {
  const out: number[] = [];
  for (let o = -2; o < 3; o++) for (const m of scale) out.push(m + 12 * o);
  return out;
}

/** the scale note `steps` scale steps away from midi (which must be in the scale, else the nearest one) */
function step(midi: number, scale: number[], steps: number): number {
  const l = ladderOf(scale);
  let i = l.findIndex((m) => m >= midi);
  if (i < 0) i = l.length - 1;
  return l[Math.max(0, Math.min(l.length - 1, i + steps))];
}

/** pentatonic arpeggio from the first scale note at or above `root`: 8 eighth notes */
function arpeggio(root: number, scale: number[], vel: number, pattern = [0, 2, 4, 5, 7, 5, 4, 2]): Note[] {
  const l = ladderOf(scale);
  const start = Math.max(0, l.findIndex((m) => m >= root));
  return pattern.map((k, i) => ({ t: i * 0.5, inst: 'zheng' as Inst, midi: l[Math.min(l.length - 1, start + k)], dur: 1.5, vel: vel * (i === 0 ? 1 : 0.8) }));
}

function melody(m: Mel, inst: Inst, vel: number, transpose = 0): Note[] {
  return m.map(([t, midi, dur]) => ({ t, inst, midi: midi + transpose, dur, vel }));
}

/** long pipa notes are played as soft tremolo, the way the instrument sustains */
function pipaLine(m: Mel, vel: number, transpose = 0): Note[] {
  const out: Note[] = [];
  for (const [t, midi, dur] of m) {
    if (dur >= 1.5) {
      for (let k = 0; k < dur * 4 - 1; k++) out.push({ t: t + k * 0.25, inst: 'pipa', midi: midi + transpose, dur: 0.3, vel: vel * (k === 0 ? 1 : 0.45) });
    } else out.push({ t, inst: 'pipa', midi: midi + transpose, dur, vel });
  }
  return out;
}

function perc(bar: number, busy: boolean): Note[] {
  const n: Note[] = [
    { t: 0, inst: 'drum', midi: 0, dur: 0.5, vel: 0.9 },
    { t: 1, inst: 'block', midi: 0, dur: 0.1, vel: 0.5 },
    { t: 2.5, inst: 'drum', midi: 0, dur: 0.5, vel: 0.55 },
    { t: 3, inst: 'block', midi: 0, dur: 0.1, vel: 0.5 },
  ];
  if (busy) for (let k = 0; k < 8; k++) n.push({ t: k * 0.5, inst: 'shaker', midi: 0, dur: 0.1, vel: k % 2 ? 0.35 : 0.2 });
  if (bar % 4 === 3) n.push({ t: 3.5, inst: 'block', midi: 0, dur: 0.1, vel: 0.35 });
  return n;
}

// ---------------------------------------------------------------- Morning Tea (C)

const C_PENTA = [60, 62, 64, 67, 69];
const TEA_MEL: Mel[] = [
  [
    [0, 76, 1],
    [1, 79, 1],
    [2, 81, 1.5],
    [3.5, 79, 0.5],
  ],
  [
    [0, 76, 1.5],
    [1.5, 74, 0.5],
    [2, 72, 2],
  ],
  [
    [0, 69, 1],
    [1, 72, 1],
    [2, 74, 1],
    [3, 76, 1],
  ],
  [
    [0, 74, 3],
    [3, 67, 1],
  ],
  [
    [0, 76, 1],
    [1, 79, 1],
    [2, 84, 1.5],
    [3.5, 81, 0.5],
  ],
  [
    [0, 79, 1],
    [1, 76, 1],
    [2, 74, 1],
    [3, 76, 1],
  ],
  [
    [0, 81, 1],
    [1, 79, 0.5],
    [1.5, 76, 0.5],
    [2, 74, 1],
    [3, 72, 1],
  ],
  [
    [0, 72, 3],
    [3, 67, 1],
  ],
];
const TEA_ROOTS = [48, 45, 41, 43, 48, 52, 41, 48]; // C Am F G C Em F C (bass roots)

export const MORNING_TEA: Track = {
  name: 'Morning Tea',
  bpm: 96,
  bars: 16,
  bar(i) {
    const k = i % 8;
    const second = i >= 8;
    const root = TEA_ROOTS[k];
    const notes: Note[] = [
      { t: 0, inst: 'bass', midi: root, dur: 2, vel: 0.8 },
      { t: 2, inst: 'bass', midi: root + 7, dur: 2, vel: 0.5 },
      ...arpeggio(root + 12, C_PENTA, second ? 0.42 : 0.5),
      ...perc(i, second),
    ];
    if (!second) notes.push(...melody(TEA_MEL[k], 'flute', 0.7));
    else {
      notes.push(...pipaLine(TEA_MEL[k], 0.6));
      // the flute answers a sixth below on the long notes
      for (const [t, midi, dur] of TEA_MEL[k]) if (dur >= 1.5) notes.push({ t: t + 0.5, inst: 'flute', midi: step(midi, C_PENTA, -2), dur: dur - 0.5, vel: 0.35 });
    }
    return notes;
  },
};

// ---------------------------------------------------------------- Lantern Walk (G)

const G_PENTA = [55, 57, 59, 62, 64];
const WALK_MEL: Mel[] = [
  [
    [0, 74, 0.5],
    [0.5, 76, 0.5],
    [1, 79, 1],
    [2, 76, 0.5],
    [2.5, 74, 0.5],
    [3, 71, 1],
  ],
  [
    [0, 69, 0.5],
    [0.5, 71, 0.5],
    [1, 74, 1.5],
    [2.5, 71, 0.5],
    [3, 69, 1],
  ],
  [
    [0, 67, 0.5],
    [0.5, 69, 0.5],
    [1, 71, 0.5],
    [1.5, 74, 0.5],
    [2, 76, 1],
    [3, 79, 1],
  ],
  [
    [0, 81, 1.5],
    [1.5, 79, 0.5],
    [2, 76, 2],
  ],
  [
    [0, 74, 0.5],
    [0.5, 76, 0.5],
    [1, 79, 1],
    [2, 81, 0.5],
    [2.5, 83, 0.5],
    [3, 81, 1],
  ],
  [
    [0, 79, 0.5],
    [0.5, 76, 0.5],
    [1, 74, 1],
    [2, 76, 0.5],
    [2.5, 79, 0.5],
    [3, 76, 1],
  ],
  [
    [0, 74, 1],
    [1, 71, 0.5],
    [1.5, 69, 0.5],
    [2, 71, 1],
    [3, 74, 1],
  ],
  [
    [0, 67, 2],
    [3, 74, 0.5],
    [3.5, 76, 0.5],
  ],
];
const WALK_ROOTS = [43, 40, 48, 50, 43, 40, 48, 43]; // G Em C D G Em C G

export const LANTERN_WALK: Track = {
  name: 'Lantern Walk',
  bpm: 108,
  bars: 16,
  bar(i) {
    const k = i % 8;
    const second = i >= 8;
    const root = WALK_ROOTS[k];
    const notes: Note[] = [
      { t: 0, inst: 'bass', midi: root, dur: 1, vel: 0.8 },
      { t: 1.5, inst: 'bass', midi: root + 7, dur: 1, vel: 0.45 },
      { t: 2, inst: 'bass', midi: root + 12, dur: 1, vel: 0.5 },
      ...arpeggio(root + 12, G_PENTA, 0.38, second ? [0, 4, 2, 5, 4, 7, 5, 4] : [0, 2, 4, 2, 5, 4, 2, 4]),
      ...perc(i, true),
    ];
    if (!second) {
      notes.push(...pipaLine(WALK_MEL[k], 0.65));
      // flute echo at the end of each phrase
      if (k % 2 === 1) notes.push({ t: 3, inst: 'flute', midi: WALK_MEL[k][0][1] + 12, dur: 1, vel: 0.3 });
    } else notes.push(...melody(WALK_MEL[k], 'flute', 0.62), ...pipaLine(WALK_MEL[k].filter(([t]) => t % 1 === 0), 0.3, -12));
    return notes;
  },
};

export const TRACKS: Track[] = [MORNING_TEA, LANTERN_WALK];

// ---------------------------------------------------------------- synthesis

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx: BaseAudioContext, secs: number) {
  const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * secs)), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = noiseBuffer(ctx, 1);
    noiseCache.set(ctx, b);
  }
  return b;
}

/** a plucked string: zheng (warm), pipa (bright, short), bass (soft, low) */
function pluck(ctx: BaseAudioContext, out: AudioNode, t: number, hz: number, vel: number, kind: 'zheng' | 'pipa' | 'bass') {
  const decay = kind === 'pipa' ? 0.9 : kind === 'bass' ? 1.6 : 2.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel * (kind === 'bass' ? 0.26 : kind === 'pipa' ? 0.36 : 0.3), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  const bright = kind === 'pipa' ? 12 : kind === 'bass' ? 3 : 8;
  f.frequency.setValueAtTime(Math.min(12000, hz * bright), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(200, hz * 1.6), t + (kind === 'pipa' ? 0.25 : 0.6));
  f.Q.value = kind === 'pipa' ? 2 : 0.8;
  f.connect(g).connect(out);
  const parts: [OscillatorType, number, number][] =
    kind === 'pipa'
      ? [
          ['sawtooth', 1, 0.5],
          ['triangle', 2, 0.4],
        ]
      : kind === 'bass'
        ? [
            ['triangle', 1, 1],
            ['sine', 2, 0.25],
          ]
        : [
            ['triangle', 1, 1],
            ['sine', 2, 0.4],
            ['sine', 3.01, 0.15],
          ];
  for (const [type, mul, v] of parts) {
    const o = ctx.createOscillator();
    o.type = type;
    // a tiny pitch fall at the attack, like a plucked string
    o.frequency.setValueAtTime(hz * mul * 1.006, t);
    o.frequency.exponentialRampToValueAtTime(hz * mul, t + 0.06);
    const og = ctx.createGain();
    og.gain.value = v;
    o.connect(og).connect(f);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

/** a soft bamboo flute: breathy attack, gentle vibrato */
function flute(ctx: BaseAudioContext, out: AudioNode, t: number, hz: number, dur: number, vel: number) {
  const end = t + Math.max(0.15, dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel * 0.27, t + 0.07);
  g.gain.setValueAtTime(vel * 0.27, end - 0.08);
  g.gain.linearRampToValueAtTime(vel * 0.21, end - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0005, end + 0.25);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(9000, hz * 6);
  lp.connect(g).connect(out);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz;
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = hz * 2;
  const o2g = ctx.createGain();
  o2g.gain.value = 0.12;
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.2;
  const vibG = ctx.createGain();
  vibG.gain.setValueAtTime(0, t);
  vibG.gain.linearRampToValueAtTime(hz * 0.005, t + 0.3);
  vib.connect(vibG);
  vibG.connect(o.frequency);
  vibG.connect(o2.frequency);
  o.connect(lp);
  o2.connect(o2g).connect(lp);
  // breath
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = hz * 2;
  bp.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vel * 0.06, t);
  ng.gain.exponentialRampToValueAtTime(vel * 0.012, t + 0.15);
  ng.gain.setValueAtTime(vel * 0.012, end);
  ng.gain.linearRampToValueAtTime(0, end + 0.2);
  n.connect(bp).connect(ng).connect(out);
  for (const x of [o, o2, vib]) {
    x.start(t);
    x.stop(end + 0.3);
  }
  n.start(t);
  n.stop(end + 0.25);
}

function percussion(ctx: BaseAudioContext, out: AudioNode, t: number, kind: 'block' | 'drum' | 'shaker', vel: number) {
  if (kind === 'shaker') {
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
    n.connect(hp).connect(g).connect(out);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.06);
    return;
  }
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  if (kind === 'block') {
    o.type = 'sine';
    o.frequency.setValueAtTime(1250, t);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.04);
    g.gain.setValueAtTime(vel * 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.07);
  } else {
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.14);
    g.gain.setValueAtTime(vel * 0.13, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
  }
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.35);
}

export function playNote(ctx: BaseAudioContext, out: AudioNode, n: Note, t: number, secPerBeat: number) {
  switch (n.inst) {
    case 'flute':
      return flute(ctx, out, t, midiHz(n.midi), n.dur * secPerBeat, n.vel);
    case 'zheng':
    case 'pipa':
    case 'bass':
      return pluck(ctx, out, t, midiHz(n.midi), n.vel, n.inst);
    default:
      return percussion(ctx, out, t, n.inst, n.vel);
  }
}

/** schedule one bar of a track starting at time t0; returns the bar's length in seconds */
export function scheduleBar(ctx: BaseAudioContext, out: AudioNode, track: Track, bar: number, t0: number): number {
  const spb = 60 / track.bpm;
  // a touch of human timing so the loop never feels mechanical
  for (const n of track.bar(bar % track.bars)) playNote(ctx, out, n, t0 + n.t * spb + (n.inst === 'shaker' ? 0 : (Math.random() - 0.5) * 0.008), spb);
  return spb * 4;
}

/** a small, warm room */
export function makeReverb(ctx: BaseAudioContext, secs = 2.2) {
  const conv = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * secs);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  conv.buffer = ir;
  return conv;
}

/** render `secs` seconds of a track offline (used to export audio samples); returns a 16-bit stereo WAV */
export async function renderTrackWav(index: number, secs: number, sampleRate = 44100): Promise<Uint8Array> {
  const ctx = new OfflineAudioContext(2, Math.floor(secs * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const rev = makeReverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  rev.connect(wet).connect(master);
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(master);
  bus.connect(rev);
  const track = TRACKS[index];
  let t = 0.05;
  for (let bar = 0; t < secs; bar++) t += scheduleBar(ctx, bus, track, bar, t);
  const buf = await ctx.startRendering();
  // fade the last second out
  const n = buf.length;
  const data = [buf.getChannelData(0), buf.getChannelData(1)];
  const fade = Math.floor(sampleRate * 1.2);
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  out.setUint32(4, 36 + n * 4, true);
  w(8, 'WAVEfmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 2, true);
  out.setUint32(24, sampleRate, true);
  out.setUint32(28, sampleRate * 4, true);
  out.setUint16(32, 4, true);
  out.setUint16(34, 16, true);
  w(36, 'data');
  out.setUint32(40, n * 4, true);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[0][i]), Math.abs(data[1][i]));
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < n; i++) {
    const f = i > n - fade ? (n - i) / fade : 1;
    for (let c = 0; c < 2; c++) out.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, data[c][i] * norm * f)) * 32767, true);
  }
  return new Uint8Array(out.buffer);
}
