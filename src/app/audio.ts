/**
 * Calm generated audio (Web Audio, no files): a slow pentatonic plucked-string melody over a soft drone, and gentle
 * tile sounds. Everything goes through one master gain so a portal pause can silence it instantly.
 */

type Sfx = 'select' | 'match' | 'mismatch' | 'shuffle' | 'hint' | 'win' | 'button' | 'undo' | 'restore';

const PENTA = [0, 2, 4, 7, 9]; // major pentatonic degrees
const ROOT = 50; // D3 (MIDI)

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private musicOn = true;
  private soundOn = true;
  private adMuted = false;
  private hidden = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNote = 0;
  private step = 0;
  private degree = 7;
  private drone: OscillatorNode[] = [];

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
    this.reverb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 3.2);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.reverb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(this.reverb);
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
  /** portal ad playing: silence everything; afterwards the player's own settings come back */
  setAdMuted(m: boolean) {
    this.adMuted = m;
    this.apply();
  }

  private apply() {
    const c = this.ctx;
    if (!c) return;
    const silent = this.adMuted || this.hidden;
    const now = c.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(silent ? 0 : 1, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.soundOn ? 0.9 : 0, now, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.55 : 0, now, 0.6);
    const wantMusic = this.musicOn && !silent;
    if (wantMusic && !this.timer) this.startMusic();
    if (!wantMusic && this.timer) this.stopMusic();
    if (silent && c.state === 'running' && this.adMuted) void c.suspend().catch(() => {});
    if (!silent && c.state === 'suspended') void c.resume().catch(() => {});
  }

  private startMusic() {
    const c = this.ctx!;
    this.nextNote = c.currentTime + 0.3;
    // soft drone: root and fifth, slowly breathing
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.05, c.currentTime, 3);
    g.connect(this.musicBus);
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();
    for (const [m, det] of [
      [ROOT - 12, -4],
      [ROOT - 5, 3],
      [ROOT, 0],
    ]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = midiHz(m);
      o.detune.value = det;
      o.connect(g);
      o.start();
      this.drone.push(o);
    }
    this.drone.push(lfo);
    this.timer = setInterval(() => this.schedule(), 200);
  }

  private stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const o of this.drone)
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    this.drone = [];
  }

  private schedule() {
    const c = this.ctx!;
    const beat = 60 / 64;
    while (this.nextNote < c.currentTime + 0.6) {
      const t = this.nextNote;
      const bar = this.step % 16;
      // gentle random walk on the pentatonic scale, phrases of 8 beats with rests
      const rest = bar === 7 || bar === 15 || Math.random() < 0.22;
      if (!rest) {
        this.degree = Math.max(3, Math.min(12, this.degree + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        const oct = Math.floor(this.degree / 5);
        const m = ROOT + 12 + oct * 12 - 12 + PENTA[this.degree % 5];
        this.pluck(t, midiHz(m), 0.16);
        if (bar % 8 === 0) this.pluck(t, midiHz(m - 12), 0.09);
        if (Math.random() < 0.18) this.pluck(t + beat / 2, midiHz(m + (Math.random() < 0.5 ? 2 : -3)), 0.08);
      }
      this.step++;
      this.nextNote += beat * (Math.random() < 0.15 ? 2 : 1);
    }
  }

  /** a plucked zither-like note */
  private pluck(t: number, hz: number, vol: number, bus: GainNode = this.musicBus, decay = 2.4) {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(9000, hz * 7), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(300, hz * 1.5), t + 0.8);
    f.connect(g).connect(bus);
    for (const [type, mul, v] of [
      ['triangle', 1, 1],
      ['sine', 2, 0.35],
      ['sine', 3.01, 0.12],
    ] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(hz * mul * 1.004, t);
      o.frequency.exponentialRampToValueAtTime(hz * mul, t + 0.08);
      const og = c.createGain();
      og.gain.value = v;
      o.connect(og).connect(f);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  }

  /** a soft ceramic "tock" */
  private tock(t: number, hz: number, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz, t);
    o.frequency.exponentialRampToValueAtTime(hz * 0.6, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.14);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.16);
    const n = c.createBufferSource();
    const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = b;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz * 2.2;
    bp.Q.value = 2;
    const ng = c.createGain();
    ng.gain.value = vol * 0.6;
    n.connect(bp).connect(ng).connect(this.sfxBus);
    n.start(t);
  }

  play(s: Sfx) {
    const c = this.ctx;
    if (!c || !this.soundOn || this.adMuted) return;
    const t = c.currentTime + 0.005;
    const scale = (d: number) => midiHz(ROOT + 24 + PENTA[d % 5] + 12 * Math.floor(d / 5));
    switch (s) {
      case 'select':
        this.tock(t, 1150, 0.22);
        break;
      case 'button':
        this.tock(t, 900, 0.14);
        break;
      case 'undo':
        this.tock(t, 700, 0.18);
        this.tock(t + 0.07, 560, 0.12);
        break;
      case 'mismatch':
        this.tock(t, 330, 0.2);
        break;
      case 'match':
        this.tock(t, 1250, 0.18);
        this.pluck(t + 0.02, scale(2), 0.11, this.sfxBus, 1.4);
        this.pluck(t + 0.11, scale(4), 0.09, this.sfxBus, 1.6);
        break;
      case 'hint':
        this.pluck(t, scale(5), 0.08, this.sfxBus, 1.2);
        this.pluck(t + 0.09, scale(7), 0.07, this.sfxBus, 1.4);
        break;
      case 'shuffle':
        for (let i = 0; i < 9; i++) this.tock(t + i * 0.045 + Math.random() * 0.02, 700 + Math.random() * 600, 0.08);
        break;
      case 'restore':
        [0, 2, 4, 5, 7].forEach((d, i) => this.pluck(t + i * 0.16, scale(d + 2), 0.09, this.sfxBus, 2));
        break;
      case 'win':
        [0, 1, 2, 3, 4, 5, 7, 9].forEach((d, i) => this.pluck(t + i * 0.12, scale(d), 0.1, this.sfxBus, 2.2));
        break;
    }
  }
}

export const audio = new GameAudio();
