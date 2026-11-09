// start `vite preview` for a built folder and resolve once it answers
import { spawn } from 'node:child_process';

export async function serve(port, mode = 'web') {
  const args = ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
  if (mode !== 'web') args.push('--mode', mode);
  const proc = spawn('npx', args, { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return { url, close: () => proc.kill() };
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  proc.kill();
  throw new Error('preview server did not start');
}
