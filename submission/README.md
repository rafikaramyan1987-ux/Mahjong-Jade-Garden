# Mahjong Jade Garden — CrazyGames submission

| File | What |
|---|---|
| `mahjong-jade-garden-v1.zip` | unzips to `mahjong-jade-garden-v1/index.html` — one self-contained file (~440 KB), CrazyGames SDK v3 build |
| `cover-1920x1080.png`, `cover-800x1200.png`, `cover-800x800.png` | covers rendered by the game; the top-left corner is kept clear for the CrazyGames label |
| `trailer-1920x1080.mp4`, `trailer-1080x1620.mp4` | ≤ 20 s of real gameplay (2:3 portrait version included): the illustrated tiles, matches with the glow and sparkle effect, a cleared board restoring part of the garden, the journey and the Jade Garden |

Rebuild everything with `npm run submission:crazygames`.

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

Come back every day for the **Daily Challenge** — the same board for every player — and win **bronze, silver or
gold medals** by time while you build your **day streak**. Every deal is guaranteed solvable, Shuffle always leaves a
board you can finish, and there is never a time limit. Calm, cheerful music and soft sounds complete a relaxing
daily puzzle. Prefer the traditional look? Switch to the Classic tile set in Settings.

## Controls

- **Mouse / touch:** click or tap two free tiles with the same picture to remove them.
- A tile is free when nothing lies on top of it and its left or right side is open (blocked tiles are shaded).
- **Hint**, **Undo** and **Shuffle** buttons below the board (right side on wide screens).
- **Zoom:** pinch on touch screens, mouse wheel on desktop; the corner button fits the board again.

## Tags

mahjong, mahjong solitaire, tile matching, solitaire, puzzle, relaxing, casual, matching, classic, brain, daily challenge,
mobile

## Technical notes

- CrazyGames SDK v3: `loadingStart`/`loadingStop` while booting; `gameplayStart`/`gameplayStop` only around real play
  (stopped in menus, pause, dialogs, result screens and during ads); `happytime` when a board is solved
- Midgame ads only between boards, never before the 3rd board is cleared and at most one per ~2 minutes; no pre-roll
- Rewarded ads only for optional extras: +1 Hint, +1 Shuffle, +1 Undo, and Continue (re-deal the remaining tiles into a
  solvable position) when no pairs are left. The reward is granted only after the ad finished; every request settles
  once (finished, error or nothing started within 8 s) and otherwise shows "No ad available right now, try later"
- Saves through the Data Module (localStorage fallback); the platform mute setting is respected; no external links,
  no logins; English and French (follows the CrazyGames language)
