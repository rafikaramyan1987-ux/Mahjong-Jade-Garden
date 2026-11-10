# Mahjong Jade Garden — Playgama

## Description

Classic Mahjong Solitaire with a fresh, friendly look: bright illustrated tiles (koi, lotus, lanterns, pandas, cranes) that stay large and easy to read, even on a phone. Every board you clear restores part of the Jade Garden through four seasons, 64 boards in all. Chain quick matches for combos, earn up to three stars, play the Daily Challenge for medals and a streak. Every deal is solvable, no time limit. 10 languages.

## Controls

- **Mouse / touch:** click or tap two free tiles with the same picture to remove them.
- A tile is free when nothing lies on top of it and its left or right side is open (blocked tiles are shaded).
- **Hint**, **Undo** and **Shuffle** buttons below the board (right side on wide screens).
- **Keyboard (optional):** H hint, U undo, S shuffle, P pause. No Esc key is used.
- **Zoom:** pinch on touch screens, mouse wheel on desktop; the corner button fits the board again.

## Tags

mahjong, mahjong solitaire, solitaire, tile matching, puzzle, relaxing, casual, classic, daily challenge, mobile

## Files

| File | What |
|---|---|
| `mahjong-jade-garden-playgama-v1.zip` | the Playgama build: `index.html` at the zip root (the whole game inlined), `playgama-bridge.js` (Bridge 2.4.1) + `playgama-bridge-config.json` beside it; relative paths only |
| `cover-800x800.png`, `cover-1080x1920.png`, `cover-1920x1080.png` | the three covers Playgama's form takes (square, portrait, landscape), made with Playgama's own covers script from 1920x1080 / 1080x1920 screenshots of real play and the game's title font (Lora Bold) |
| `icon-512x512.png` | icon (same as submission-web/) |

- **Orientation:** both (landscape and portrait layouts; a square window works too).
- **Languages:** English (default and fallback), French, German, Italian, Spanish, Portuguese, Dutch, Polish,
  Turkish, Russian; taken from Bridge's `platform.language` (a language picked in Settings wins).

## Playgama Bridge

- **Version: 2.4.1** (pinned): the official standalone `playgama` build from github.com/Playgama/bridge tag `v2.4.1`,
  vendored in `vendor/playgama-bridge/` (sha256 `b016a8d6…adc25`, checked in CI, reproducible with
  `bash scripts/playgama/build-bridge.sh`). Shipped inside the zip, so the game loads nothing from outside.
- `bridge.initialize()` before the save is read and anything is shown (at most 10 s; without Bridge the game plays
  on with no ads); `game_ready` once the loading screen is gone; `level_started` / `level_completed` per board;
  progress through Bridge Storage only (key `mahjongjadegarden.save.v1`, read in one `storage.get`); interstitials
  only after a cleared board (Next / Journey / Menu), never before the 3rd board is cleared and at most one per ~2
  minutes, plus `minimumDelayBetweenInterstitial: 120`; rewarded ads only from the labelled "Watch an ad: +1 hint /
  shuffle / undo" buttons (hidden when `isRewardedSupported` is false), the reward only after Bridge's `rewarded`
  state, the dead-end rewarded shuffle at most once per board; audio muted (AudioContext suspended) and the board
  paused during ads, on Bridge's pause state and when the page is hidden; Bridge's audio state mutes.

## Rebuild

```sh
npm ci
npm run submission:playgama   # vite --mode playgama → submission-playgama/mahjong-jade-garden-playgama-v1.zip
npm run check:playgama        # zip checks + Playgama's precheck
npm run test:playgama         # Bridge mock + stubbed Playgama SDK test (Playwright)
```
