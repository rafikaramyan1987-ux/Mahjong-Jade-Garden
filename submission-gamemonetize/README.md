# Mahjong Jade Garden — GameMonetize submission

- **Game ID:** `ux7a998kv63s60z7m9q5dbm2241i0e09` (already in the build; checked in CI)
- **Upload:** `mahjong-jade-garden-gamemonetize-v1.zip`, with `index.html` at the zip root. It is one self-contained file
  that uses relative paths only, about 320 KB.
- **Images (no text, no logo, each under 300 KB):** `mahjong-jade-garden-512x384.jpg`, `mahjong-jade-garden-512x512.jpg`,
  `mahjong-jade-garden-512x340.jpg`. Each is the game's own cover scene (the Jade Garden and a fan of tiles), rendered
  by the game with the title logo removed (`?shot=cover&nologo`).

## Form fields (ready to paste)

**Name**
```
Mahjong Jade Garden
```

**Categories** (pick 2–3): Puzzles, Board, Casual. Use the closest names in GameMonetize's dropdown. These names were
not checked against the live form.

**Tags**
```
mahjong, mahjong solitaire, solitaire, tiles, matching, pairs, puzzle, classic, relaxing, casual, brain, logic, garden, daily challenge, mobile, html5
```

**Width / Height:** `1280` x `720` (the game fills any frame, landscape or portrait)

**Optimized for Mobile Devices:** Yes (touch controls, pinch zoom, portrait and landscape layouts)

**Description** (521 characters, limit 600)
```
Mahjong Jade Garden is a calm, classic Mahjong Solitaire. Match pairs of identical free tiles with bright pictures of pandas, red pandas, koi, cranes, lotus and lanterns. Journey mode: 64 boards from gentle to challenging; every cleared board restores part of the Jade Garden through spring, summer, autumn and winter. Daily Challenge: a new board every day with medals and a streak. Earn up to 3 stars per board, chain quick matches into combos. Every deal is solvable; Hint, Undo and Shuffle help anytime. 10 languages.
```

**Controls** (308 characters, limit 350)
```
Desktop: click two free tiles with the same picture to remove them. A tile is free when nothing is on top and its left or right side is open. Mouse wheel zooms. Keys: H hint, U undo, S shuffle, P pause.
Mobile: tap two matching free tiles; pinch to zoom. Hint, Undo and Shuffle buttons are next to the board.
```

## Ads in this build (GameMonetize SDK)

- At boot, the game sets `window.SDK_OPTIONS = { gameId, onEvent }` and then inserts
  `https://api.gamemonetize.com/sdk.js` once, the same way the SDK README's loader does (`<script id="gamemonetize-sdk">`).
  It is never loaded from a click. If it fails to load, the game plays on without ads.
- `SDK_GAME_PAUSE` pauses the game and silences all audio. `SDK_GAME_START` resumes the game, and audio comes back
  through the player's own Music and Sounds settings. Interstitials are allowed only after `SDK_READY`.
- `sdk.showBanner()` is called only at the same breaks as the GameDistribution build, and only after a player click:
  - Play on the title screen (pre-roll, once per session);
  - Next, Journey or Menu on a cleared board's result screen, from the 3rd cleared board on.
  
  There is at most one every ~2 minutes. No ad is ever shown during a board or on a timer. Every request settles
  exactly once: on `SDK_GAME_START`, on an error, or when no ad has started within 8 s.
- **No rewarded ads:** GameMonetize has no rewarded API, so this build has no "watch an ad" buttons. Used-up hints,
  undos and shuffles just show 0, and a dead end offers the free shuffle or Undo.
- There are no other ad networks, external links or "More games" buttons. Saves stay in localStorage.

## Rebuild

```sh
npm ci
npm run submission:gamemonetize   # vite --mode gamemonetize → dist-gamemonetize/ → zip + checks
npm run test:e2e:gamemonetize     # Playwright smoke test of dist-gamemonetize with a stubbed SDK
npm run media:gamemonetize        # the three JPGs
```
