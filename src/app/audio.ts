/**
 * Audio, all generated with the Web Audio API: the background music (two composed tracks that alternate, see
 * music.ts) and the sound effects. Music plays quieter than the effects. Separate Music / Sounds switches; a portal
 * pause (ad) or a hidden tab silences everything, and afterwards the player's own settings come back.
 */
import { TRACKS, makeReverb, scheduleBar } from './music';

type Sfx = 'select' | 'match' | 'mismatch' | 'shuffle' | 'hint' | 'win' | 'button' | 'undo' | 'restore';

/** C major pentatonic, two octaves up from C5, for chimes */
const CHIME = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export const MUSIC_LEVEL = 0.32;
export const SFX_LEVEL = 0.9;
/** loops of a track before the other one starts */
const LOOPS_PER_TRACK = 2;

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private musicOn = true;
  private soundOn = true;
  private adMuted = false;
  private platformMuted = false;
  private hidden = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarAt = 0;
  private track = 0;
  private bar = 0;

  /** create / resume the context; call from a user gesture */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.build();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.apply();
    } catch {
      /* audio unavailable: play silently */
    }
  }

  private build() {
    const c = this.ctx!;
    this.master = c.createGain();
    this.master.connect(c.destination);
    const rev = makeReverb(c);
    const wet = c.createGain();
    wet.gain.value = 0.28;
    rev.connect(wet).connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.musicBus.connect(rev);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(rev);
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden;
      this.apply();
    });
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    this.apply();
  }
  setSound(on: boolean) {
    this.soundOn = on;
    this.apply();
  }
  /** the portal's own mute setting (e.g. CrazyGames muteAudio): silence everything while it is on */
  setPlatformMuted(m: boolean) {
    this.platformMuted = m;
    this.apply();
  }
  /** portal ad playing: silence everything; afterwards the player's own settings come back */
  setAdMuted(m: boolean) {
    this.adMuted = m;
    this.apply();
  }

  private apply() {
    const c = this.ctx;
    if (!c) return;
    const silent = this.adMuted || this.hidden || this.platformMuted;
    const now = c.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(silent ? 0 : 1, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.soundOn ? SFX_LEVEL : 0, now, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? MUSIC_LEVEL : 0, now, 0.5);
    const wantMusic = this.musicOn && !silent;
    if (wantMusic && !this.timer) this.startMusic();
    if (!wantMusic && this.timer) this.stopMusic();
    if (silent && c.state === 'running' && this.adMuted) void c.suspend().catch(() => {});
    if (!silent && c.state === 'suspended') void c.resume().catch(() => {});
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
    while (this.nextBarAt < c.currentTime + 0.6) {
      const tr = TRACKS[this.track];
      this.nextBarAt += scheduleBar(c, this.musicBus, tr, this.bar, this.nextBarAt);
      this.bar++;
      if (this.bar >= tr.bars * LOOPS_PER_TRACK) {
        this.bar = 0;
        this.track = (this.track + 1) % TRACKS.length;
      }
    }
  }

  /** a bell-like chime: bright partials that fade quickly over a warm body */
  private chime(t: number, hz: number, vol: number, decay = 1.4) {
    const c = this.ctx!;
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
      o.connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + d + 0.05);
    }
  }

  /** a soft wooden "tock" (tile taps) */
  private tock(t: number, hz: number, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz, t);
    o.frequency.exponentialRampToValueAtTime(hz * 0.7, t + 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.13);
    const n = c.createBufferSource();
    const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.025), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = b;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz * 2.4;
    bp.Q.value = 2.5;
    const ng = c.createGain();
    ng.gain.value = vol * 0.5;
    n.connect(bp).connect(ng).connect(this.sfxBus);
    n.start(t);
  }

  /** `combo` (0..5): quick successive matches climb the scale, which feels rewarding */
  play(s: Sfx, combo = 0) {
    const c = this.ctx;
    if (!c || !this.soundOn || this.adMuted || this.platformMuted) return;
    const t = c.currentTime + 0.005;
    const k = Math.max(0, Math.min(5, combo));
    switch (s) {
      case 'select':
        this.tock(t, 1250, 0.2);
        break;
      case 'button':
        this.tock(t, 950, 0.13);
        break;
      case 'undo':
        this.tock(t, 820, 0.16);
        this.tock(t + 0.07, 640, 0.12);
        break;
      case 'mismatch':
        this.tock(t, 380, 0.16);
        break;
      case 'match':
        this.tock(t, 1350, 0.14);
        this.chime(t + 0.02, midiHz(CHIME[k]), 0.16, 1.1);
        this.chime(t + 0.1, midiHz(CHIME[k + 2]), 0.14, 1.4);
        this.chime(t + 0.18, midiHz(CHIME[k + 4]), 0.08, 1.2);
        break;
      case 'hint':
        this.chime(t, midiHz(CHIME[4]), 0.1, 1);
        this.chime(t + 0.12, midiHz(CHIME[6]), 0.09, 1.2);
        break;
      case 'shuffle':
        for (let i = 0; i < 8; i++) this.tock(t + i * 0.045 + Math.random() * 0.02, 800 + Math.random() * 600, 0.07);
        this.chime(t + 0.42, midiHz(CHIME[3]), 0.08, 1);
        break;
      case 'restore':
        [0, 2, 4, 5, 7].forEach((d, i) => this.chime(t + 0.3 + i * 0.14, midiHz(CHIME[d]), 0.09, 1.6));
        break;
      case 'win':
        [0, 1, 2, 3, 4, 5, 7, 9].forEach((d, i) => this.chime(t + i * 0.11, midiHz(CHIME[d]), 0.12, 1.8));
        break;
    }
  }
}

export const audio = new GameAudio();
