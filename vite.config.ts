import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Portals this game can be built for; add a name here plus an implementation in src/app/platform/. */
const PLATFORMS = ['web', 'gd', 'crazygames', 'gamepix'] as const;
type PlatformName = (typeof PLATFORMS)[number];

/** GameDistribution game id of Mahjong Jade Garden (can be overridden with GD_GAME_ID=... for testing) */
const GD_GAME_ID = process.env.GD_GAME_ID || '2708776451364ee68eca7c869f5371e0';

/**
 * Build target portal: `VITE_PLATFORM=web|gd|crazygames|gamepix`, or `--mode gd` / `--mode crazygames` / `--mode gamepix`;
 * default `web` (GitHub Pages, self-hosting).
 * The web build goes to dist/, the others to dist-<platform>/.
 */
function platformFor(mode: string): PlatformName {
  const p = process.env.VITE_PLATFORM || (PLATFORMS.includes(mode as PlatformName) ? mode : 'web');
  if (!PLATFORMS.includes(p as PlatformName)) throw new Error(`unknown VITE_PLATFORM "${p}" (${PLATFORMS.join(' | ')})`);
  return p as PlatformName;
}

/** GamePix SDK v3: the only third-party script of the GamePix build, loaded before the game bundle */
const GPX_SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';

/**
 * GamePix build only: the SDK script tags (manual lifecycle) at the top of <head>, a loading screen (hidden once
 * the menu is shown: body[data-ready]), no browser gestures on the page (the scrolling lists keep pan-y), and the
 * SDK's local ad simulator above the game layers.
 */
function gamepixHtml(): Plugin {
  const css = [
    'html,body{touch-action:none}',
    '.journey-list,.panel{touch-action:pan-y}',
    '#adMainContainer{z-index:2147483000!important}',
    // GamePix has its own loading screen (below), reporting to the Player
    '#boot{display:none!important}',
    '#gpx-loading{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#2f7f5d;color:#f7efdc;font:600 22px Georgia,serif}',
    '#gpx-loading .b{width:min(320px,70vw);height:10px;border-radius:5px;background:rgba(255,255,255,.18);overflow:hidden}',
    '#gpx-loading i{display:block;height:100%;width:0;background:#ecca7c;transition:width .2s}',
    'body[data-ready="1"] #gpx-loading{display:none}',
    // short landscape iframes (e.g. 640 x 480): title and menu side by side so every button stays on screen
    '@media (max-height:600px) and (min-aspect-ratio:1/1){.title-wrap{flex-direction:row;justify-content:center;gap:28px;width:min(900px,100%);padding:8px 16px}.logo{margin:0;flex:1 1 0;min-width:0}.logo .jg{font-size:clamp(36px,8vh,64px)}.logo .tag{font-size:16px}.menu{flex:1 1 0;min-width:0;max-width:380px}.menu .btn{min-height:46px;margin-top:8px}}',
  ].join('');
  return {
    name: 'gamepix-html',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        { tag: 'script', children: "window.GamePixConfig = { lifecycle: 'manual' };", injectTo: 'head-prepend' },
        { tag: 'script', attrs: { src: GPX_SDK_URL }, injectTo: 'head-prepend' },
        { tag: 'style', children: css, injectTo: 'head' },
        { tag: 'div', attrs: { id: 'gpx-loading' }, children: 'Mahjong Jade Garden<div class="b"><i></i></div>', injectTo: 'body-prepend' },
      ],
    },
  };
}

/**
 * Single-file builds: move the inlined game script (and its big inlined stylesheet with the fonts) from <head> to
 * the end of <body>, so the browser paints the small loading screen as soon as the first bytes arrive.
 */
function scriptLast(): Plugin {
  return {
    name: 'script-last',
    enforce: 'post',
    // after vite-plugin-singlefile (also order: 'post', earlier in the plugin list) has inlined everything
    generateBundle: { order: 'post', handler(_o, bundle) {
      const html = Object.values(bundle).find((a) => a.type === 'asset' && a.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset' || typeof html.source !== 'string') return;
      let src = html.source;
      const moved: string[] = [];
      src = src.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>\s*/g, (m) => (moved.push(m.trim()), ''));
      src = src.replace(/<style rel="stylesheet"[^>]*>[\s\S]*?<\/style>\s*/g, (m) => (moved.unshift(m.trim()), ''));
      if (moved.length) src = src.replace('</body>', moved.join('\n') + '\n</body>');
      html.source = src;
    } },
  };
}

export default defineConfig(({ mode }) => {
  const platform = platformFor(mode);
  return {
    base: './',
    plugins: platform === 'gamepix' ? [viteSingleFile(), gamepixHtml(), scriptLast()] : [viteSingleFile(), scriptLast()],
    // the GD game id goes into the GD build only
    define: { __PLATFORM__: JSON.stringify(platform), __GD_GAME_ID__: JSON.stringify(platform === 'gd' ? GD_GAME_ID : '') },
    build: {
      target: 'es2020',
      outDir: platform === 'web' ? 'dist' : `dist-${platform}`,
      assetsInlineLimit: 100_000_000,
      chunkSizeWarningLimit: 4000,
    },
    server: { host: true },
  };
});
