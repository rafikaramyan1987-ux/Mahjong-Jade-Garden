import '@fontsource/lora/latin-600.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import './ui/style.css';
import { loadTileFont } from './art/tileArt';
import { gpxLoading } from './app/platform/gamepixLoading';

async function boot() {
  const q = new URLSearchParams(location.search);
  // GamePix build: boot progress for the Player and the loading screen (index.html)
  if (__PLATFORM__ === 'gamepix') gpxLoading(10);
  await Promise.all([loadTileFont(), document.fonts.load('600 20px Lora'), document.fonts.load('700 20px "Source Sans 3"'), document.fonts.load('400 20px "Source Sans 3"'), document.fonts.load('700 20px Lora')]);
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
  const { startApp } = await import('./app/app');
  if (__PLATFORM__ === 'gamepix') gpxLoading(80);
  await startApp();
}
void boot();
