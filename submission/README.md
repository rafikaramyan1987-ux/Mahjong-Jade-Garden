# Mahjong Jade Garden — CrazyGames submission

## What changed in v2

- Instant start: new players are in board 1 within seconds, with a hands-on tutorial inside the board (no text pages); boards 1–3 are small, quick wins.
- More juice: tiles lift, fly together and burst into sparkles and petals; 3-second combos with a multiplier, bonus points and rising chimes; animated 1–3 star results; the journey map blooms as you play.
- Clear goals and help: tiles left, a progress bar and the star target always visible; a free Shuffle at a dead end; Hint / Undo / Shuffle with optional "Watch an ad: +1" (TV icon); pause menu and H / U / S / P keys.
- New main menu over the garden art, a glossy illustrated look everywhere (garden, buttons, icons), larger tiles on phones held sideways, a large-tile option, balanced audio.
- 10 languages (EN, FR, DE, IT, ES, PT, NL, PL, TR, RU), following the CrazyGames locale.

## Files

| File | What |
|---|---|
| `mahjong-jade-garden-v2.zip` | **v2 upload**: unzips to `mahjong-jade-garden-v2/index.html` — one self-contained file (~560 KB, about 320 KB zipped), CrazyGames SDK v3 build. Same structure as v1 |
| `cover-1920x1080.png`, `cover-800x1200.png`, `cover-800x800.png` | **v2 covers**, rendered by the game in its new look; title "Mahjong Jade Garden"; the top-left corner is kept clear for the CrazyGames label |
| `trailer-1920x1080.mp4`, `trailer-1080x1920.mp4` | **v2 trailers**, about 18 s, no sound, recorded from real play: the first seconds of the tutorial, a fast combo chain, the 3-star result screen and the journey map blooming. The first frame is the cover |
| `mahjong-jade-garden-v1.zip` | the v1 upload, kept for reference |

Rebuild everything with `npm run submission:crazygames` (trailers only: `npm run build && node scripts/trailer.mjs`).
A 60-second recording of a brand-new player on a 390 x 844 phone: [docs/media/first-minute-v2-390x844.mp4](../docs/media/first-minute-v2-390x844.mp4).

## Short description

A calm, colourful Mahjong Solitaire: match illustrated tiles and bring a Chinese garden back to life through four seasons.

## Description

Mahjong Jade Garden is classic Mahjong Solitaire with a fresh, friendly look. Instead of hard-to-read symbols, every
tile is a bright, glossy illustration — koi, lotus, lanterns, pandas, red pandas, cranes, dumplings, kites and more —
on polished ivory tiles that stay large and easy to read on every board, even on a phone.

Each board you clear restores one part of the **Jade Garden**: a stone lantern, a moon bridge, a koi pond, a pagoda…
Travel through **spring, summer, autumn and winter** across 64 hand-tuned boards that grow from gentle to
challenging with more layers, not smaller tiles. Replay any finished board from the journey map to earn three stars
and beat your best time.

Quick matches build **combos**: chain matches within three seconds for a growing multiplier, bonus points and
seconds back on the clock, then earn up to **three stars** on every board.

Come back every day for the **Daily Challenge** — the same board for every player — and win **bronze, silver or
gold medals** by time while you build your **day streak**. Every deal is guaranteed solvable, Shuffle always leaves a
board you can finish, and there is never a time limit. Calm, cheerful music and soft sounds complete a relaxing
daily puzzle. Prefer the traditional look? Switch to the Classic tile set in Settings.

## Controls

- **Mouse / touch:** click or tap two free tiles with the same picture to remove them.
- A tile is free when nothing lies on top of it and its left or right side is open (blocked tiles are shaded).
- **Hint**, **Undo** and **Shuffle** buttons below the board (right side on wide screens).
- **Keyboard (optional):** H hint, U undo, S shuffle, P pause.
- **Zoom:** pinch on touch screens, mouse wheel on desktop; the corner button fits the board again. Settings → Tile size → Large starts every board zoomed in.

## Tags

mahjong, mahjong solitaire, tile matching, solitaire, puzzle, relaxing, casual, matching, classic, brain, daily challenge,
mobile

## Technical notes

- CrazyGames SDK v3: `loadingStart`/`loadingStop` while booting; `gameplayStart`/`gameplayStop` only around real play
  (stopped in menus, pause, dialogs, result screens and during ads); `happytime` when a board is solved
- Midgame ads only between boards, never before the 3rd board is cleared and at most one per ~2 minutes; no pre-roll
- Rewarded ads only for optional extras, from a clearly labelled button with a TV icon ("Watch an ad: +1 hint"):
  +1 Hint, +1 Shuffle, +1 Undo (each starts with free uses per board), and a rewarded shuffle at a dead end once the
  free one is used. The reward is granted only after the ad finished; every request settles once (finished, error or
  nothing started within 8 s) and otherwise shows "No ad available right now, try later" for 2.5 s
- A brand-new player starts board 1 directly after loading (loadingStop, then gameplayStart); the tutorial is inside
  the board
- Saves through the Data Module (localStorage fallback); the platform mute setting is respected live (music and
  sounds); no external links, no logins
- 10 languages (English, French, German, Italian, Spanish, Portuguese, Dutch, Polish, Turkish, Russian) chosen from
  the CrazyGames SDK locale, changeable in Settings
- Keyboard shortcuts use `KeyboardEvent.code` (QWERTY and AZERTY alike); Escape and Ctrl / Cmd are never used
