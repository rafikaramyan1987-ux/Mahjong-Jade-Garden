import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Portals this game can be built for; add a name here plus an implementation in src/app/platform/. */
const PLATFORMS = ['web', 'gd', 'crazygames'] as const;
type PlatformName = (typeof PLATFORMS)[number];

/** GameDistribution game id (replace the placeholder with the id from the GD developer dashboard). */
const GD_GAME_ID = process.env.GD_GAME_ID || 'TODO_GD_GAME_ID';

/**
 * Build target portal: `VITE_PLATFORM=web|gd|crazygames`, or `--mode gd` / `--mode crazygames`; default `web` (GitHub Pages, self-hosting).
 * The web build goes to dist/, the others to dist-<platform>/.
 */
function platformFor(mode: string): PlatformName {
  const p = process.env.VITE_PLATFORM || (PLATFORMS.includes(mode as PlatformName) ? mode : 'web');
  if (!PLATFORMS.includes(p as PlatformName)) throw new Error(`unknown VITE_PLATFORM "${p}" (${PLATFORMS.join(' | ')})`);
  return p as PlatformName;
}

export default defineConfig(({ mode }) => {
  const platform = platformFor(mode);
  return {
    base: './',
    plugins: [viteSingleFile()],
    define: { __PLATFORM__: JSON.stringify(platform), __GD_GAME_ID__: JSON.stringify(GD_GAME_ID) },
    build: {
      target: 'es2020',
      outDir: platform === 'web' ? 'dist' : `dist-${platform}`,
      assetsInlineLimit: 100_000_000,
      chunkSizeWarningLimit: 4000,
    },
    server: { host: true },
  };
});
