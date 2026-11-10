# Mahjong Jade Garden — GamePix submission

**File:** `mahjong-jade-garden-gamepix-v3.zip` (v3: `index.html` at the root of the zip; one self-contained file, about
320 KB zipped; v3 also declares the legacy `GamePix.soundOff / soundOn / pause / resume` properties and reads
`GamePix.lang()` once at boot); `mahjong-jade-garden-gamepix-v1.zip` and `-v2.zip` are kept.
**Icon:** `icon-256x256.jpg` · **Cover:** `cover-1360x850.jpg` (v2, the game's own cover renderer with the GamePix art);
the v1 `icon-512x512.png` and `cover-1280x720.png` are kept.
**Video:** `gameplay-gamepix-1280x720.mp4` (about 45 s: title, one board, a rewarded hint, the local fake interstitial)
Rebuild everything with `npm run submission:gamepix` (`--no-video` skips the recording).

## Name

Mahjong Jade Garden

## Short description

A calm, classic Mahjong Solitaire in a sunny garden. Match pairs of identical free tiles with bright, glossy
pictures of koi, pandas, cranes, tulips and more. Every cleared board restores part of the Jade Garden through four
seasons. 64 solvable boards, a daily challenge and no time pressure.

## Long description

Mahjong Jade Garden is a relaxing take on classic Mahjong Solitaire. Match pairs of identical free tiles —
vivid, glossy illustrations of koi, lanterns, pandas, red pandas, cranes, tulips, bonsai trees and more on polished
ivory tiles — among bamboo, plum blossom and red lanterns (the traditional Classic tiles are one tap away in
Settings). Every board you clear restores part of the Jade Garden — a garden bench, a moon bridge, a koi pond, a
weeping willow — through spring, summer, autumn and winter.

Play 64 hand-tuned boards from gentle to challenging, each in a wide and a tall version so the tiles stay large on
phones and desktops. Every deal is guaranteed solvable, and Shuffle always leaves a solvable board. A new daily
challenge every day earns bronze, silver or gold medals and builds a day streak. Hint, Undo and Shuffle are always at
hand, the clock never runs out, and soft original music keeps it calm.

## Controls

- Tap or click two free tiles with exactly the same picture to remove them.
- A tile is free when nothing lies on top of it and its left or right side is open (blocked tiles are shaded).
- Hint, Undo and Shuffle are below the board (on the right in landscape).
- Pinch or use the mouse wheel to zoom; the button under the menu resets the zoom.
- Mouse and touch, portrait and landscape.

## Tags

mahjong, mahjong solitaire, solitaire, tiles, matching, pairs, puzzle, classic, board, relaxing, casual, brain,
logic, garden, daily challenge, mobile, html5

## Technical notes (GamePix build)

- GamePix JS SDK v3 is the only third-party script: `https://integration.gamepix.com/sdk/v3/gamepix.sdk.js`, an
  external `<script src>` before the game bundle, with `window.GamePixConfig = { lifecycle: 'manual' }`.
- Lifecycle: `lifecycle.loading()` during boot (10 → 50 → 80 → 100, with a loading bar), `await lifecycle.loaded()`
  before the menu is shown, `lifecycle.gameStart()` once, when the first board starts.
- `pause` / `resume` (idempotent): the clock stops, input is blocked, all audio is muted (AudioContext suspended);
  on resume the player's own Music / Sounds settings come back.
- `soundOff` / `soundOn` (idempotent, `GamePix.events.on`, with the legacy `GamePix.on.soundOff / soundOn` callbacks as
  a fallback; the same handlers are also assigned to `GamePix.soundOff / soundOn / pause / resume`, and a signal that
  arrives through both the event and the property is handled once): soundOff mutes all audio without pausing; soundOn brings it back only if the player's own settings
  allow it and no pause or ad is active (unit-tested for every order of pause, soundOff and an ad). The game also pauses and mutes when the tab is hidden
  (`visibilitychange`), never on window blur.
- Interstitials (`ads.interstitial()`) only between boards (Next / Menu / Journey on the result screen), never before
  the 3rd cleared board and at most one per ~2 minutes; no pre-roll.
- Rewarded ads (`ads.reward()`) only from an explicit button ("Watch an ad: +1 Hint / Shuffle / Undo", "Watch an ad:
  Continue"); the reward is granted only on `success === true`, otherwise "No ad available right now, try later"
  shows for 2.5 s. Every offer has a Close button.
- `happyMoment('level_complete')` when a board is cleared, `sadMoment('game_over')` at a real dead end (no pairs and
  no shuffle left).
- Language from `GamePix.lang()` (English, French, German, Italian, Spanish, Portuguese, Dutch, Polish, Turkish,
  Russian; anything else falls back to English).
- Progress is saved in plain `localStorage` (one known key, read with `getItem`).
- No external links, no other ads, analytics or SDKs; no quit button; no rotate prompt (both orientations play).
- Art: the GamePix build replaces the pictures that could be read as religious symbols with neutral garden pictures
  (lotus → tulip, pagoda → bonsai, bell → watering can, crescent moon with stars → snail, a neutral mooncake stamp,
  Classic lotus flower → camellia; in the garden scene stone lantern → garden bench, pagoda → weeping willow, lotus
  flowers → water lilies; the cross-shaped "Lotus Cross" board → a "Lily Pad" board).
