# Mahjong Jade Garden — GameDistribution submission

**File:** `mahjong-jade-garden-gd-v1.zip` (`index.html` at the root of the zip; one self-contained file, about 250 KB)
**Thumbnails (JPG, rendered by the game):** `thumb-512x384.jpg`, `thumb-512x512.jpg`, `thumb-200x120.jpg`,
`thumb-1280x720.jpg`, `thumb-1280x550.jpg`
**Screenshots:** `screenshots/` (1920x1080 landscape, 1080x1920 portrait)
**Game ID:** set at build time — `GD_GAME_ID=<id> npm run submission:gd` (the build currently carries the placeholder
`TODO_GD_GAME_ID`; rebuild with the real ID before uploading).

## Name

Mahjong Jade Garden

## Description

A calm, classic Mahjong Solitaire in a sunny Chinese garden. Match pairs of identical free tiles — bright,
vivid, glossy illustrations of koi, lotus, lanterns, pandas, red pandas, cranes and more on polished ivory
tiles — among bamboo, plum
blossom and red lanterns (the traditional Classic tiles are one tap away in Settings). Every board you clear restores
part of the Jade Garden — a stone lantern, a moon bridge, a koi pond, a pagoda — through spring, summer, autumn
and winter. 64 hand-tuned boards from gentle to challenging, a new daily challenge every day, and every deal is
guaranteed solvable. Large, clear tiles, no time pressure and soft music make it a relaxing daily game.

## Instructions

Tap or click two tiles with exactly the same picture to remove them. A tile can be taken when nothing lies on top
of it and its left or right side is open (blocked tiles are shaded). Clear all the tiles to finish the board. Use Hint, Undo and Shuffle whenever you like; pinch or use the mouse wheel
to zoom.

## Key features

- Classic Mahjong Solitaire rules with 144 tiles; only identical pictures match
- Two original tile sets: bright illustrated Garden pictures (default) and traditional Classic faces
- 64 boards in increasing difficulty, each with a wide and a tall version so tiles are large on phones and desktops
- Every deal is solvable (solver-verified); Shuffle always leaves a solver-verified solvable board
- Big tiles everywhere: the board fills the screen and tiles stay large on every board; harder boards stack
  more layers instead of shrinking the tiles
- Jade Garden journey: restore 16 garden elements in each of the 4 seasons
- Journey screen: replay any finished board to improve your stars and best time
- Daily challenge (the same board for everyone each day) with bronze / silver / gold medals, a personal best and a
  day streak; statistics and star ratings by time and hints
- Hint, Undo and Shuffle; optional rewarded ads for one more of each, and a rewarded Continue when stuck; no coins,
  no shop
- Accessibility: large high-contrast tiles, free tiles highlighted, colorblind-friendly suits, zoom, no time limit
- Light, warm music (two original pentatonic tracks with flute, guzheng and pipa) and satisfying match chimes;
  separate music and sound switches; English and French
- Portrait and landscape, mouse and touch; saves progress automatically

## Tags

mahjong, mahjong solitaire, solitaire, tiles, matching, pairs, puzzle, classic, board, relaxing, casual, brain,
logic, chinese, garden, daily challenge, mobile, html5

## Technical notes

- Single `index.html`, no external requests except the GameDistribution SDK (`main.min.js`, loaded once at start)
- `SDK_GAME_PAUSE` pauses the game and mutes all audio; `SDK_GAME_START` resumes and restores the audio settings
- Interstitials only after a user action outside play: Play (pre-roll) and Next / Menu between boards, never before
  the 3rd board is cleared. Interstitials are rate-limited to one per ~2 minutes.
  Rewarded ads only for an optional extra hint, shuffle or undo, or a Continue when stuck; the reward is granted on
  `SDK_REWARDED_WATCH_COMPLETE`
- Every ad request settles exactly once (completion, error / cancel, or nothing started within 8 s); when no ad is
  available the button shows "No ad available right now, try later" for 2.5 s
- If the SDK cannot load, the game remains fully playable
- Progress is saved in localStorage (in-memory fallback); no external links, no logins
