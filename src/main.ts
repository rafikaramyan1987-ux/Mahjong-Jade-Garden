import '@fontsource/lora/latin-600.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import './ui/fonts-ext.css';
import './ui/style.css';
import { loadTileFont } from './art/tileArt';
import { gpxLoading } from './app/platform/gamepixLoading';

/** the loading screen's bar (index.html): it crawls while the file downloads, then follows the real boot steps */
function bootProgress(p: number) {
  const bar = document.querySelector('#boot i') as HTMLElement | null;
  if (!bar) return;
  bar.style.animation = 'none';
  bar.style.width = Math.max(parseFloat(bar.style.width) || 0, p) + '%';
}

async function boot() {
  bootProgress(66);
  const q = new URLSearchParams(location.search);
  // GamePix build: boot progress for the Player and the loading screen (index.html)
  if (__PLATFORM__ === 'gamepix') gpxLoading(10);
  // the fonts are inlined; load every face (Latin, Polish / Turkish, Cyrillic) before the first frame: no text jumps
  const sample = 'Aąğя';
  await Promise.all([loadTileFont(), ...['600 20px Lora', '700 20px Lora', '400 20px "Source Sans 3"', '600 20px "Source Sans 3"', '700 20px "Source Sans 3"'].map((f) => document.fonts.load(f, sample))]);
  const shot = q.get('shot');
  if (shot === 'tiles' || shot === 'tiles-classic' || shot === 'tiles-contrast') {
    const { renderTileSheet } = await import('./art/sheet');
    renderTileSheet(document.getElementById('bg') as HTMLCanvasElement, innerWidth, innerHeight, shot === 'tiles' ? 'garden' : shot === 'tiles-classic' ? 'classic' : 'contrast');
    document.body.dataset.ready = '1';
    return;
  }
  if (shot === 'cover') {
    const { renderCover } = await import('./art/cover');
    renderCover(document.getElementById('bg') as HTMLCanvasElement, innerWidth, innerHeight, q.has('notag') ? null : undefined, { clearTopLeft: q.has('cg') });
    document.body.dataset.ready = '1';
    return;
  }
  if (shot === 'levels') {
    // loudness of every effect and both music tracks, as heard in the game (scripts/audio-levels.mjs)
    const { SFX_LIST, renderSfx, renderMusic, loudness } = await import('./app/audio');
    const out: Record<string, number> = {};
    for (const s of SFX_LIST) out[s] = loudness(await renderSfx(s, s === 'combo' ? 3 : 0));
    // music: the average over 20 s (it plays all the time, under the effects)
    for (const k of [0, 1]) out[`music${k + 1}`] = loudness(await renderMusic(k, 20), 44100, 20);
    (window as unknown as { __levels: unknown }).__levels = out;
    document.body.dataset.ready = '1';
    return;
  }
  if (shot === 'music') {
    // offline render of a music track as WAV (base64) for the audio samples script
    const { renderTrackWav } = await import('./app/music');
    const wav = await renderTrackWav(Number(q.get('track') || 0), Number(q.get('secs') || 30));
    let bin = '';
    for (let i = 0; i < wav.length; i += 0x8000) bin += String.fromCharCode(...wav.subarray(i, i + 0x8000));
    (window as unknown as { __wav: string }).__wav = btoa(bin);
    document.body.dataset.ready = '1';
    return;
  }
  if (__PLATFORM__ === 'gamepix') gpxLoading(50);
  bootProgress(82);
  const { startApp } = await import('./app/app');
  if (__PLATFORM__ === 'gamepix') gpxLoading(80);
  bootProgress(94);
  await startApp();
  bootProgress(100);
  setTimeout(() => document.getElementById('boot')?.remove(), 600);
  // Playgama: Bridge's game_ready once the loading screen has faded out (body[data-ready], 0.35 s) and the player can play
  if (__PLATFORM__ === 'playgama') setTimeout(() => void import('./app/sdk').then(({ sdk }) => sdk.gameReady?.()), 500);
}
void boot();
