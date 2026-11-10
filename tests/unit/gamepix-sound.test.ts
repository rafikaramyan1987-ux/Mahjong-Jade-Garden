/**
 * GamePix soundOff / soundOn next to pause / resume and ads, wired the way the game wires them
 * (sdk.onAdPause -> audio.setAdMuted, sdk.onMute -> audio.setPlatformMuted, see src/app/app.ts), checked with the
 * game's own audio gate. Every interleaving of a Player pause, a soundOff and an ad is tried.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio, audioGate } from '../../src/app/audio';
import { GamePixPlatform, type GPXAdResult, type GPXSdk } from '../../src/app/platform/gamepix';

function fakeSdk(legacy = false) {
  const handlers: Record<string, () => void> = {};
  let answer: (r: GPXAdResult) => void = () => {};
  const ad = () => new Promise<GPXAdResult>((res) => (answer = res));
  const sdk = {
    lang: () => 'en',
    lifecycle: { loading: () => {}, loaded: () => Promise.resolve(), gameStart: () => {} },
    events: legacy ? (undefined as unknown as GPXSdk['events']) : { on: (name: string, fn: () => void) => void (handlers[name] = fn) },
    on: legacy ? ({} as NonNullable<GPXSdk['on']>) : undefined,
    ads: { interstitial: () => ad(), reward: () => ad() },
  } as GPXSdk;
  const emit = (name: 'pause' | 'resume' | 'soundOff' | 'soundOn') => (legacy ? sdk.on![name]?.() : handlers[name]?.());
  return { sdk, emit, answer: (r: GPXAdResult) => answer(r) };
}

async function setup(legacy = false, music = true, sound = true) {
  const f = fakeSdk(legacy);
  (globalThis as unknown as { window: unknown }).window = { GamePix: f.sdk };
  const gp = new GamePixPlatform(() => f.sdk);
  await gp.init();
  const audio = new GameAudio();
  audio.setMusic(music);
  audio.setSound(sound);
  // the game's wiring
  audio.setPlatformMuted(gp.muted);
  gp.onMute = (m) => audio.setPlatformMuted(m);
  const pauses: boolean[] = [];
  gp.onAdPause = (p) => (pauses.push(p), audio.setAdMuted(p));
  return { f, gp, audio, pauses };
}

describe('GamePix soundOff / soundOn', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('soundOff mutes everything without pausing; soundOn brings the sound back; both idempotent', async () => {
    const { f, gp, audio, pauses } = await setup();
    expect(audio.gate().sfx).toBe(true);
    f.emit('soundOff');
    f.emit('soundOff');
    expect(gp.muted).toBe(true);
    expect(audio.gate()).toMatchObject({ silent: true, music: false, sfx: false, suspend: false });
    expect(pauses).toEqual([]);
    f.emit('soundOn');
    f.emit('soundOn');
    expect(gp.muted).toBe(false);
    expect(audio.gate()).toMatchObject({ silent: false, music: true, sfx: true });
  });

  it("soundOn respects the player's own settings", async () => {
    const { f, audio } = await setup(false, false, true);
    f.emit('soundOff');
    f.emit('soundOn');
    expect(audio.gate().music).toBe(false);
    expect(audio.gate().sfx).toBe(true);
    audio.setSound(false);
    expect(audio.gate().sfx).toBe(false);
  });

  it('legacy GamePix.on.soundOff / soundOn callbacks work the same way', async () => {
    const { f, audio, pauses } = await setup(true);
    f.emit('soundOff');
    expect(audio.gate().silent).toBe(true);
    f.emit('pause');
    f.emit('soundOn');
    expect(audio.gate().silent).toBe(true);
    f.emit('resume');
    expect(audio.gate().silent).toBe(false);
    expect(pauses).toEqual([true, false]);
  });

  // three overlapping causes of silence, each with a start and an end, in every possible order (90 orders)
  type Ev = 'pause' | 'resume' | 'soundOff' | 'soundOn' | 'adStart' | 'adEnd';
  const pairs: [Ev, Ev][] = [
    ['pause', 'resume'],
    ['soundOff', 'soundOn'],
    ['adStart', 'adEnd'],
  ];
  function orders(): Ev[][] {
    const out: Ev[][] = [];
    const rec = (seq: Ev[], started: Set<number>, ended: Set<number>) => {
      if (seq.length === 6) return void out.push(seq);
      pairs.forEach(([a, b], i) => {
        if (!started.has(i)) rec([...seq, a], new Set([...started, i]), ended);
        else if (!ended.has(i)) rec([...seq, b], started, new Set([...ended, i]));
      });
    };
    rec([], new Set(), new Set());
    return out;
  }

  it('pause, soundOff and an ad overlapping in any order: sound only when none is active, game paused only by pause or ad', async () => {
    const all = orders();
    expect(all).toHaveLength(90);
    for (const order of all) {
      for (const sdkResumes of [false, true]) {
        const { f, gp, audio } = await setup();
        let ad: Promise<boolean> | null = null;
        const on = { pause: false, soundOff: false, ad: false };
        for (const ev of order) {
          if (ev === 'pause') {
            on.pause = true;
            f.emit('pause');
          }
          if (ev === 'resume') {
            on.pause = false;
            f.emit('resume');
          }
          if (ev === 'soundOff') {
            on.soundOff = true;
            f.emit('soundOff');
          }
          if (ev === 'soundOn') {
            on.soundOff = false;
            f.emit('soundOn');
          }
          if (ev === 'adStart') {
            on.ad = true;
            ad = gp.rewarded();
            // the SDK pauses the game for its ad
            f.emit('pause');
          }
          if (ev === 'adEnd') {
            on.ad = false;
            // some SDK versions send resume before answering, some never do
            if (sdkResumes && !on.pause) f.emit('resume');
            f.answer({ success: true });
            expect(await ad).toBe(true);
          }
          await vi.advanceTimersByTimeAsync(0);
          const label = `${order.join(' > ')} (sdk resume: ${sdkResumes}) after ${ev}`;
          const g = audio.gate();
          const silentExpected = on.pause || on.soundOff || on.ad;
          expect(g.silent, label).toBe(silentExpected);
          expect(g.sfx, label).toBe(!silentExpected);
          // the audio clock stops only for a pause or an ad, never for soundOff alone
          expect(g.suspend, label).toBe(on.pause || on.ad);
        }
        expect(audio.gate()).toMatchObject({ silent: false, music: true, sfx: true, suspend: false });
      }
    }
  });
});

describe('audio gate', () => {
  it('is silent while any cause is on and follows the player settings otherwise', () => {
    const base = { music: true, sound: true, paused: false, platformMuted: false, hidden: false };
    expect(audioGate(base)).toEqual({ silent: false, music: true, sfx: true, suspend: false });
    expect(audioGate({ ...base, hidden: true }).sfx).toBe(false);
    expect(audioGate({ ...base, platformMuted: true })).toEqual({ silent: true, music: false, sfx: false, suspend: false });
    expect(audioGate({ ...base, paused: true }).suspend).toBe(true);
    expect(audioGate({ ...base, music: false })).toEqual({ silent: false, music: false, sfx: true, suspend: false });
  });
});
