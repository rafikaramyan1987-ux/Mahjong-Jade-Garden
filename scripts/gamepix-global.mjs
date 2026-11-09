// Preload for `npm run audit:gamepix`: run the layout audit on the GamePix build's board shapes
// (src/layouts/catalog.ts reads __PLATFORM__ when it is defined, as vite's `define` does in the builds).
globalThis.__PLATFORM__ = 'gamepix';
