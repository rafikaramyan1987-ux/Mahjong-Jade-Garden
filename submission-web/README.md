# Mahjong Jade Garden

**Tagline:** Match illustrated tiles and bring a Chinese garden back to life.

## Description

Classic Mahjong Solitaire with a fresh, friendly look: bright illustrated tiles (koi, lotus, lanterns, pandas, cranes) that stay large and easy to read, even on a phone. Every board you clear restores part of the Jade Garden through four seasons, 64 boards in all. Chain quick matches for combos, earn up to three stars, play the Daily Challenge for medals and a streak. Every deal is solvable, no time limit. 10 languages.

## Controls

- **Mouse / touch:** click or tap two free tiles with the same picture to remove them.
- A tile is free when nothing lies on top of it and its left or right side is open (blocked tiles are shaded).
- **Hint**, **Undo** and **Shuffle** buttons below the board (right side on wide screens).
- **Keyboard (optional):** H hint, U undo, S shuffle, P pause.
- **Zoom:** pinch on touch screens, mouse wheel on desktop; the corner button fits the board again.

## Genre

Puzzle (Mahjong Solitaire, tile matching)

## Tags

mahjong, mahjong solitaire, solitaire, tile matching, puzzle, relaxing, casual, classic, daily challenge, mobile

## Ad-free build

This web build (the plain `web` platform, the same build as the GitHub Pages version) contains **no ads and no
portal SDK**: no interstitials, no rewarded-ad buttons and no "watch an ad" offers. When the hints, shuffles or undos of
a board run out, the "+1" extra is simply free ("Free: +1 hint"). No analytics, no external requests (fonts, art and
music are all in the one `index.html`), no external links.

## Files

| File | What |
|---|---|
| `mahjong-jade-garden-web-v1.zip` | the game: one self-contained `index.html` at the zip root (upload as an HTML5 game, "played in the browser") |
| `cover-630x500.png` | itch.io cover, from the main cover art (`submission/cover-1920x1080.png`) |
| `icon-512x512.png` | icon |
| `screenshot-1.png` … `screenshot-4.png` | 1280x720 gameplay: board 1 with the tutorial hand, a journey board half cleared, a combo chain, the 3-star win screen |
| `checks/iframe-<w>x<h>.png` | the zip in an iframe at 640x480, 960x600, 1280x720 and 390x844 after board 1 was played (scripts/web/check.mjs) |

- **Embed size:** any; the game fills its frame (landscape and portrait). Suggested itch.io viewport 960x600,
  "mobile friendly" on; the game has no fullscreen button of its own (itch.io's works).
- **Saves:** localStorage, key `mahjongjadegarden.save.v1` only (a JSON document: settings, journey, stars, daily
  streak); `__mjg` is a write probe removed at once.

## Rebuild

```sh
npm ci
npm run submission:web     # web build (vite build, platform web → dist/) → submission-web/mahjong-jade-garden-web-v1.zip
npm run check:web -- submission-web/mahjong-jade-garden-web-v1.zip --shots submission-web/checks
npm run store:web          # cover, icon and the four screenshots
```
