/**
 * Audio, all generated with the Web Audio API: the background music (two composed tracks that alternate, see
 * music.ts) and the sound effects. Every effect is balanced to about the same loudness (see `SFX_GAIN`, measured
 * with `npm run audio:levels`); music plays below the effects.
 *
 * What may be heard is decided by one pure function, `audioGate`: the player's Music / Sounds switches, the
 * portal's mute setting (CrazyGames muteAudio, GamePix soundOff), a pause or an ad (portal pause, GamePix pause) and
 * a hidden tab. Each source only switches its own flag, so they can overlap in any order: sound comes back only
 * once none of them asks for silence, and then exactly as the player set it.
 */
import { TRACKS, makeReverb, scheduleBar } from './music';

export type Sfx = 'select' | 'match' | 'mismatch' | 'shuffle' | 'hint' | 'win' | 'button' | 'undo' | 'restore' | 'star' | 'combo';
export const SFX_LIST: Sfx[] = ['select', 'match', 'mismatch', 'shuffle', 'hint', 'win', 'button', 'undo', 'restore', 'star', 'combo'];

/** C major pentatonic from C5, for chimes */
const CHIME = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98];
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export const MUSIC_LEVEL = 0.11;
/** per-track trim so both tracks play at the same loudness (Lantern Walk is lighter) */
export const TRACK_GAIN = [0.86, 1.36];
export const SFX_LEVEL = 0.85;
/**
 * Per-effect gain, so that every effect has about the same loudness (RMS over its audible part, within ±2 dB of the
 * others, see docs/audio-levels.md). Short taps are a little quieter on purpose: they happen all the time.
 */
export const SFX_GAIN: Record<Sfx, number> = {
  select: 2.14,
  button: 2.45,
  undo: 2.02,
  mismatch: 1.58,
  match: 0.72,
  combo: 1.95,
  hint: 0.97,
  shuffle: 1.72,
  restore: 0.94,
  star: 0.98,
  win: 0.7,
};
/** loops of a track before the other one starts */
const LOOPS_PER_TRACK = 2;

export interface GateInput {
  music: boolean;
  sound: boolean;
  /** a pause or an ad (portal pause / ad events) */
  paused: boolean;
  /** the portal's mute setting (CrazyGames muteAudio, GamePix soundOff) */
  platformMuted: boolean;
  /** the tab is hidden */
  hidden: boolean;
}
export interface GateOutput {
  /** nothing may be heard at all */
  silent: boolean;
  music: boolean;
  sfx: boolean;
  /** the audio clock may stop (pause / ad: nothing is scheduled meanwhile) */
  suspend: boolean;
}

/** what may be heard right now (pure: the same input always gives the same answer) */
export function audioGate(s: GateInput): GateOutput {
  const silent = s.paused || s.platformMuted || s.hidden;
  return { silent, music: !silent && s.music, sfx: !silent && s.sound, suspend: s.paused };
}

type Voice = (c: BaseAudioContext, out: AudioNode, t: number, combo: number) => void;

/** a bell-like chime: bright partials that fade quickly over a warm body */
function chime(c: BaseAudioContext, out: AudioNode, t: number, hz: number, vol: number, decay = 1.4) {
  for (const [mul, v, d] of [
    [1, 1, decay],
    [2.0, 0.35, decay * 0.6],
    [3.0, 0.18, decay * 0.35],
    [4.2, 0.08, decay * 0.2],
  ]) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz * mul;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}

/** a soft wooden "tock" (tile taps) */
function tock(c: BaseAudioContext, out: AudioNode, t: number, hz: number, vol: number) {
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(hz, t);
  o.frequency.exponentialRampToValueAtTime(hz * 0.7, t + 0.06);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.13);
  const n = c.createBufferSource();
  const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.025), c.sampleRate);
  const d = b.getChannelData(0);
  // a fixed pattern (not Math.random) so every render of a sound is identical
  let r = 12345;
  for (let i = 0; i < d.length; i++) {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    d[i] = ((r / 0x7fffffff) * 2 - 1) * (1 - i / d.length);
  }
  n.buffer = b;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = hz * 2.4;
  bp.Q.value = 2.5;
  const ng = c.createGain();
  ng.gain.value = vol * 0.5;
  n.connect(bp).connect(ng).connect(out);
  n.start(t);
}

/** a soft, low, rounded "boop" for a tile that cannot be taken: never harsh */
function soft(c: BaseAudioContext, out: AudioNode, t: number, hz: number, vol: number) {
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(hz, t);
  o.frequency.exponentialRampToValueAtTime(hz * 0.82, t + 0.16);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = hz * 3;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.25);
}

/**
 * The effects. `combo` (0..): quick successive matches climb the pentatonic scale (a slight pitch rise each time),
 * which feels rewarding; for 'star' it is the star number (0..2).
 */
const VOICES: Record<Sfx, Voice> = {
  select: (c, o, t) => tock(c, o, t, 1250, 0.2),
  button: (c, o, t) => tock(c, o, t, 950, 0.17),
  undo: (c, o, t) => {
    tock(c, o, t, 820, 0.16);
    tock(c, o, t + 0.07, 640, 0.13);
  },
  mismatch: (c, o, t) => soft(c, o, t, 330, 0.2),
  match: (c, o, t, combo) => {
    const k = Math.max(0, Math.min(6, combo));
    tock(c, o, t, 1350, 0.12);
    chime(c, o, t + 0.02, midiHz(CHIME[k]), 0.15, 1.0);
    chime(c, o, t + 0.1, midiHz(CHIME[k + 2]), 0.13, 1.3);
    chime(c, o, t + 0.18, midiHz(CHIME[k + 4]), 0.07, 1.1);
  },
  /** on top of the match chime when a combo grows: a quick sparkle up */
  combo: (c, o, t, combo) => {
    const k = Math.max(0, Math.min(5, combo - 1));
    [0, 1, 2].forEach((d, i) => chime(c, o, t + 0.22 + i * 0.05, midiHz(CHIME[k + 3 + d]), 0.05, 0.6));
  },
  hint: (c, o, t) => {
    chime(c, o, t, midiHz(CHIME[4]), 0.11, 1);
    chime(c, o, t + 0.12, midiHz(CHIME[6]), 0.1, 1.2);
  },
  shuffle: (c, o, t) => {
    const hz = [980, 1240, 860, 1320, 1050, 900, 1180, 1400];
    for (let i = 0; i < 8; i++) tock(c, o, t + i * 0.045 + (i % 3) * 0.007, hz[i], 0.08);
    chime(c, o, t + 0.42, midiHz(CHIME[3]), 0.08, 1);
  },
  restore: (c, o, t) => [0, 2, 4, 5, 7].forEach((d, i) => chime(c, o, t + 0.3 + i * 0.14, midiHz(CHIME[d]), 0.08, 1.6)),
  star: (c, o, t, n) => {
    const k = [2, 4, 7][Math.max(0, Math.min(2, n))];
    chime(c, o, t, midiHz(CHIME[k]), 0.12, 1.2);
    chime(c, o, t + 0.05, midiHz(CHIME[k + 2]), 0.07, 1.0);
  },
  win: (c, o, t) => [0, 1, 2, 3, 4, 5, 7, 9].forEach((d, i) => chime(c, o, t + i * 0.11, midiHz(CHIME[d]), 0.1, 1.8)),
};

/** render one effect offline (for the level check script); returns mono samples */
export async function renderSfx(s: Sfx, combo = 0, sampleRate = 44100): Promise<Float32Array> {
  const c = new OfflineAudioContext(1, Math.ceil(sampleRate * 2.8), sampleRate);
  const g = c.createGain();
  g.gain.value = SFX_LEVEL * SFX_GAIN[s];
  g.connect(c.destination);
  VOICES[s](c, g, 0.01, combo);
  const buf = await c.startRendering();
  return buf.getChannelData(0);
}

/** render a stretch of a music track offline at its in-game level (for the level check script) */
export async function renderMusic(index: number, secs: number, sampleRate = 44100): Promise<Float32Array> {
  const c = new OfflineAudioContext(1, Math.ceil(sampleRate * secs), sampleRate);
  const g = c.createGain();
  g.gain.value = MUSIC_LEVEL * TRACK_GAIN[index];
  g.connect(c.destination);
  const tr = TRACKS[index];
  let t = 0.05;
  for (let bar = 0; t < secs; bar++) t += scheduleBar(c, g, tr, bar, t);
  return (await c.startRendering()).getChannelData(0);
}

/**
 * Loudness of a sound (dBFS): the loudest 300 ms window (RMS), which is what the ear compares between short effects
 * and music. Used by `npm run audio:levels`.
 */
export function loudness(x: Float32Array, sampleRate = 44100, windowSec = 0.3): number {
  const w = Math.floor(sampleRate * windowSec);
  let best = 0;
  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    acc += x[i] * x[i];
    if (i >= w) acc -= x[i - w] * x[i - w];
    if (i >= w - 1) best = Math.max(best, acc / w);
  }
  if (x.length < w) best = acc / Math.max(1, x.length);
  return 10 * Math.log10(Math.max(1e-12, best));
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private state: GateInput = { music: true, sound: true, paused: false, platformMuted: false, hidden: false };
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarAt = 0;
  private track = 0;
  private bar = 0;

  constructor() {
    if (typeof document !== 'undefined') {
      this.state.hidden = document.hidden;
      document.addEventListener('visibilitychange', () => this.set({ hidden: document.hidden }));
    }
  }

  /** create / resume the context; call from a user gesture */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.build();
      }
      this.apply();
    } catch {
      /* audio unavailable: play silently */
    }
  }

  private build() {
    const c = this.ctx!;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);
    const rev = makeReverb(c);
    const wet = c.createGain();
    wet.gain.value = 0.26;
    rev.connect(wet).connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.musicBus.connect(rev);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(rev);
  }

  /** the current gate (tests, debug) */
  gate(): GateOutput {
    return audioGate(this.state);
  }

  private set(p: Partial<GateInput>) {
    this.state = { ...this.state, ...p };
    this.apply();
  }

  setMusic(on: boolean) {
    this.set({ music: on });
  }
  setSound(on: boolean) {
    this.set({ sound: on });
  }
  /** the portal's own mute setting (CrazyGames muteAudio, GamePix soundOff): silence everything while it is on */
  setPlatformMuted(m: boolean) {
    this.set({ platformMuted: m });
  }
  /** a portal pause or an ad: silence everything; afterwards the player's own settings come back */
  setAdMuted(m: boolean) {
    this.set({ paused: m });
  }

  private apply() {
    const c = this.ctx;
    if (!c) return;
    const g = audioGate(this.state);
    const now = c.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(g.silent ? 0 : 1, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.state.sound ? SFX_LEVEL : 0, now, 0.02);
    this.musicBus.gain.setTargetAtTime(this.state.music ? MUSIC_LEVEL * TRACK_GAIN[this.track] : 0, now, 0.5);
    if (g.music && !this.timer) this.startMusic();
    if (!g.music && this.timer) this.stopMusic();
    if (g.suspend && c.state === 'running') void c.suspend().catch(() => {});
    if (!g.suspend && c.state === 'suspended') void c.resume().catch(() => {});
  }

  private startMusic() {
    this.nextBarAt = this.ctx!.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 150);
    this.schedule();
  }

  private stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** keep about half a second of music scheduled ahead; switch tracks at loop boundaries (seamless) */
  private schedule() {
    const c = this.ctx!;
    if (this.nextBarAt < c.currentTime) this.nextBarAt = c.currentTime + 0.05;
    while (this.nextBarAt < c.currentTime + 0.6) {
      const tr = TRACKS[this.track];
      this.nextBarAt += scheduleBar(c, this.musicBus, tr, this.bar, this.nextBarAt);
      this.bar++;
      if (this.bar >= tr.bars * LOOPS_PER_TRACK) {
        this.bar = 0;
        this.track = (this.track + 1) % TRACKS.length;
        // each track at its own trim, switched exactly at the loop boundary
        if (this.state.music) this.musicBus.gain.setValueAtTime(MUSIC_LEVEL * TRACK_GAIN[this.track], this.nextBarAt);
      }
    }
  }

  play(s: Sfx, combo = 0) {
    const c = this.ctx;
    if (!c || !this.gate().sfx) return;
    const t = c.currentTime + 0.005;
    const g = c.createGain();
    g.gain.value = SFX_GAIN[s];
    g.connect(this.sfxBus);
    VOICES[s](c, g, t, combo);
  }
}

export const audio = new GameAudio();
