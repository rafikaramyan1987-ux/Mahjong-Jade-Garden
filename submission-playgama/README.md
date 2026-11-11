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
| `mahjong-jade-garden-playgama-v2.zip` | **upload this one.** The Playgama build: `index.html` at the zip root (the whole game inlined), `playgama-bridge-config.json` beside it; Playgama Bridge from Playgama's CDN, initialized before the game bundle runs; otherwise relative paths only |
| `mahjong-jade-garden-playgama-v1.zip` | the previous build, kept for reference: **do not upload**. Its vendored single-platform Bridge build had no `qa_tool` adapter, so Playgama's archive check reported "Playgama Bridge never initialized in this archive" (see below) |
| `cover-800x800.png`, `cover-1080x1920.png`, `cover-1920x1080.png` | the three covers Playgama's form takes (square, portrait, landscape), made with Playgama's own covers script from 1920x1080 / 1080x1920 screenshots of real play and the game's title font (Lora Bold) |
| `icon-512x512.png` | icon (same as submission-web/) |

- **Art:** the GamePix-safe set (no religious-looking motifs), exactly as in the GamePix build: lotus → tulip,
  pagoda → bonsai, temple bell → watering can, crescent moon with stars → snail, a neutral mooncake stamp, Classic
  lotus flower → camellia; in the garden scene stone lantern → garden bench, pagoda → weeping willow, lotus → water
  lilies; the cross-shaped board → Lily Pad (with their names in every language). Covers show this art.
- **Orientation:** both (landscape and portrait layouts; a square window works too).
- **Languages:** English (default and fallback), French, German, Italian, Spanish, Portuguese, Dutch, Polish,
  Turkish, Russian; taken from Bridge's `platform.language` (a language picked in Settings wins).

## Playgama Bridge

- **Include:** `<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>`, the first script
  in `<head>`, loaded normally: the CDN option Playgama's setup page recommends (wiki.playgama.com/playgama/bridge-sdk/setup;
  `v2/stable` served Bridge 2.4.1 when v2 was built). It loads the adapter of the platform the game runs on, including
  the QA Tool's `qa_tool` adapter that Playgama's archive check uses. Requirement 1.2.5 allows the Bridge, and only it,
  from Playgama's CDN.
- **Why v1 failed the archive check:** v1 shipped a custom single-platform build (`build-dist.ts --type=standalone
  --platform=playgama`), which bundles only the `playgama`, `standalone` and `playgama_sandbox` adapters. Playgama's
  archive check and QA Tool run the game with `?platform_id=qa_tool`; that build has no `qa_tool` adapter, so Bridge fell
  back to its generic base platform (`platform.id` "mock") and never sent the QA Tool its `initialize` handshake. The
  game's own 10 s `Promise.race` and silent catch hid this.
- **Initialization:** index.html's inline boot (scripts/playgama/boot.js) calls `bridge.initialize()` right after the
  Bridge script; the game bundle is held (`<script type="text/plain" data-playgama-game>`) and starts only once
  initialize() has settled, so nothing of the game runs or loads before it (Playgama's required step 2). There is no
  timeout of the game's own (a console.warn after 15 s if it is still pending). If initialize() fails, or the Bridge
  script does not load, `console.error("[Playgama Bridge] bridge.initialize() failed; the game runs WITHOUT Playgama
  Bridge …")` and the game plays on with no ads and no Bridge storage.
- **Config:** `playgama-bridge-config.json` beside `index.html` (Bridge loads `./playgama-bridge-config.json`);
  `game_ready` once the loading screen is gone; `level_started` / `level_completed` per board;
  progress through Bridge Storage only (key `mahjongjadegarden.save.v1`, read in one `storage.get`); `game_ready` is always the first message: a
  `level_started` / `level_completed` before it (a board starting behind the loading screen) is held and sent right
  after it; interstitials at every break after a cleared board (Next / Journey / Menu), so never during a board and
  never before the first board is cleared, with no counter or timer of the game's own: how often one shows is Bridge's
  call, Bridge's own platform default delay between interstitials (no override in playgama-bridge-config.json) (Playgama's interstitial docs); rewarded ads only from the labelled "Watch an ad: +1 hint /
  shuffle / undo" buttons (hidden when `isRewardedSupported` is false), the reward only after Bridge's `rewarded`
  state, the dead-end rewarded shuffle at most once per board; audio muted (AudioContext suspended) and the board
  paused during ads, on Bridge's pause state and when the page is hidden; Bridge's audio state mutes.

## Rebuild

```sh
npm ci
npm run submission:playgama   # vite --mode playgama → submission-playgama/mahjong-jade-garden-playgama-v2.zip
npm run check:playgama        # zip checks + Playgama's precheck (no FAIL, no WARN)
npm run qa:playgama           # Playgama QA Tool harness: ?platform_id=qa_tool, Bridge's initialize handshake, game_ready
npm run test:playgama         # Bridge mock + stubbed Playgama SDK test (Playwright)
```
