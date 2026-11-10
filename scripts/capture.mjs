// Shared by the trailer and the first-minute recording: real-time CDP screencast frames of a page (at full device
// pixel resolution, with timestamps) and an ffmpeg encode to a constant 30 fps MP4 without sound, optionally
// starting with a still image (the cover).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** a soft ring where the player taps, so viewers can follow the moves */
export const RIPPLE = () => {
  addEventListener(
    'pointerdown',
    (e) => {
      const d = document.createElement('div');
      d.style.cssText = `position:fixed;left:${e.clientX - 24}px;top:${e.clientY - 24}px;width:48px;height:48px;border-radius:50%;border:4px solid rgba(255,236,170,.95);box-shadow:0 0 14px rgba(255,220,120,.8);pointer-events:none;z-index:99;transition:transform .45s ease-out,opacity .45s ease-out`;
      document.body.appendChild(d);
      requestAnimationFrame(() => {
        d.style.transform = 'scale(1.6)';
        d.style.opacity = '0';
      });
      setTimeout(() => d.remove(), 500);
    },
    true,
  );
};

export async function startCapture(ctx, page, tmp, w, h) {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: w, maxHeight: h });
  return {
    async stop() {
      await cdp.send('Page.stopScreencast');
      return frames;
    },
  };
}

/** frames (+ an optional still shown first for `stillSecs`) -> mp4 at W x H, 30 fps, no audio, at most `maxSecs` */
export function encode(frames, { tmp, out, W, H, still = null, stillSecs = 1, maxSecs = 0, crf = 20 }) {
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, (frames[i + 1]?.t ?? f.t + 0.04) - f.t).toFixed(4)}`));
  lines.push(`file '${frames.at(-1).file}'`);
  writeFileSync(join(tmp, 'list.txt'), lines.join('\n') + '\n');
  const args = ['-y', '-loglevel', 'error'];
  const norm = `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p,setsar=1`;
  if (still) {
    // the still (the cover) as its own segment, then the gameplay: the very first frame is the cover
    args.push('-loop', '1', '-t', stillSecs.toFixed(3), '-i', still, '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'));
    args.push('-filter_complex', `[0:v]${norm}[a];[1:v]${norm}[b];[a][b]concat=n=2:v=1:a=0[v]`, '-map', '[v]');
  } else {
    args.push('-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-vf', norm);
  }
  if (maxSecs) args.push('-t', String(maxSecs));
  args.push('-an', '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium', '-movflags', '+faststart', out);
  execFileSync('ffmpeg', args);
  rmSync(tmp, { recursive: true, force: true });
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim());
  console.log(`wrote ${out} (${W}x${H}, ${dur.toFixed(1)} s, no sound)`);
  return dur;
}
