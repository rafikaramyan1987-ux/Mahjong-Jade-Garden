# Mahjong Jade Garden

A calm, classic Mahjong Solitaire for web game portals (GameDistribution first, more portals later).
Bright illustrated ivory tiles (or the traditional Classic set) on warm jade felt, a quiet Chinese garden around the table, and a light “Jade Garden”
journey: every cleared board restores one part of the garden, across four seasons.

TypeScript + Vite, everything (code, fonts, art) in one `index.html`. No external requests except the portal SDK
in portal builds.

## Play

- A tile is **free** when nothing lies on top of it and its left or right side is open.
- Tap two free tiles with exactly the same picture to remove them. Only identical pictures match.
- Clear the board. **Hint**, **Undo** and **Shuffle** are below the board (right side in landscape); there is no
  time limit — the clock only counts toward the score and stars.

The set: 144 tiles, 38 pictures (34 x 4 tiles + 4 x 2 tiles).
Tile sets: **Garden** (default; 38 vivid, glossy illustrations with our own cute panda, red panda, crane, koi and
rabbit characters, plus lotus, lantern, teapot, dragon, kite, mooncake, …) and **Classic** (traditional Mahjong
faces), switchable in Settings. All artwork is original. Every Garden picture gets a finishing pass at render time
(soft per-shape gradients, boosted colour, a thick dark outline, a soft shadow and a glossy highlight); tiles have a
glossy ivory face with a thick jade side so stacked layers read at a glance. `docs/art/tile-compare-before-after.png`
shows the step from flat icons to the current pictures.

Every deal is solvable: boards are dealt by reverse construction (the removal order is a proof), and an
independent solver re-checks every journey deal and the daily challenges in CI (`npm run audit`). Shuffle re-deals
the remaining tiles the same way and confirms the result with the solver; if the remaining places themselves
cannot be cleared (e.g. the last tiles lie on each other) it also moves tiles to places that can. The first time a
player is stuck, a gentle tip explains Shuffle and Undo.

## Journey, daily challenge, balance

- **64 boards** (`src/layouts/catalog.ts`): 16 shapes x 4 seasons. Along the journey the tile count grows
  (≈ 30 → 144) and difficulty comes from more layers (towers up to 9 high), more overlap and fewer open pairs
  at the start (from 4.8 to 3.1 on average) — never from smaller tiles. Each season ends on a Jade Turtle.
- **Two variants per layout**: a wide one and a tall one (at most 6 tiles across). The game uses whichever gives
  bigger tiles on the current screen, and the board fills the screen (8 px side margins). Tiles are at least
  56 px wide on a 390 x 844 phone and 64 px on 1280 x 720 on every board (audit, unit and e2e checks).
- **Jade Garden**: each cleared journey board restores one of 16 garden elements; one season per 16 boards.
- **Journey screen** (board select, from the main menu and the result screen): all 64 boards by season, with
  stars and best time on finished boards, the next board highlighted and later boards locked. Any finished board
  can be replayed (same deal); replays only improve the best stars / time. Continue always opens the next board.
- **Daily challenge**: the same board for everyone each day (seeded by the date, no server), a personal best time,
  bronze / silver / gold medals by time (gold ≤ 3 s per tile, silver ≤ 5 s), a streak ("5 days in a row") with a
  gentle reminder on the main menu.
- **Statistics**: boards finished, total stars, best daily time, current and longest daily streak, boards played /
  cleared, win rate, best and average time, best score, tiles matched. Stars: 3 = no hint and fast, 2 = up to 2 hints or a steady pace, 1 = cleared.
- **Help per board**: 3 hints, 2 shuffles, 5 undos. When one runs out its button offers "Watch an ad: +1"; when no
  pairs are left and no shuffle remains, a rewarded "Continue" shuffles the tiles into a solvable position.
  The playtest bot (a player who takes a random open match every move) clears 99–100% of boards with at most
  2 shuffles, so the free allowance is enough; see [docs/audit.md](docs/audit.md).

## Music and sound

Two composed tracks generated in code (`src/app/music.ts`), alternating seamlessly: **Morning Tea** (C major
pentatonic, 96 bpm: bamboo flute, guzheng, woodblock) and **Lantern Walk** (G major pentatonic, 108 bpm: pipa,
flute answers, light percussion). Music plays below the effects; matches ring a bright chime that climbs with quick
successive matches. Separate Music and Sounds switches; portal pauses mute everything. 30 s samples:
`docs/media/music-*.mp3` (`node scripts/music-samples.mjs`).

## Accessibility

Large tiles that fill the screen (tall portrait variants of every layout), bright pictures that differ in shape
and colour, shaded blocked tiles (“highlight free tiles”, on by default), optional colorblind-friendly suits with
corner indices for the Classic set,
pinch / wheel zoom, readable fonts (18–24 px UI), no time pressure, reduced-motion support. English and French.

## Develop

```sh
npm install
npm run dev            # http://localhost:5173  (?fresh = ignore the save, ?seed=N = fixed deal, ?lang=fr)
npm run lint && npm run typecheck && npm test
npm run build          # web build  -> dist/index.html     (GitHub Pages)
npm run build:gd       # GD build   -> dist-gd/index.html  (VITE_PLATFORM=gd also works)
npm run build:crazygames # CrazyGames build -> dist-crazygames/index.html (VITE_PLATFORM=crazygames)
npm run build:gamepix  # GamePix build -> dist-gamepix/index.html (VITE_PLATFORM=gamepix; neutral art, see below)
npm run test:e2e       # Playwright smoke tests on the web build (1280x720 and 390x844, portrait tile size)
npm run test:e2e:gd    # the GD build with a mocked SDK (ad rules, rewards, no-SDK fallback)
npm run test:e2e:cg    # the CrazyGames build with a mocked SDK v3 (lifecycle, ads, Data Module, no-SDK fallback)
npm run audit          # layout audit + playtest bot -> docs/audit.md (CI fails on any unsolvable deal)
npm run audit:gamepix  # the same audit on the GamePix build's board shapes
npm run submission:gamepix # submission-gamepix/: zip, icon, cover, gameplay video (GamePix SDK local simulator)
npm run submission:gd  # submission-gd/: zip (index.html at the root), JPG thumbnails, screenshots
npm run submission:crazygames # submission/: zip (folder/index.html), covers, <= 20 s trailers
node scripts/art.mjs   # store / review images from the real game -> docs/art
node scripts/record.mjs # gameplay recordings -> docs/media
```

## Platforms

`src/app/platform/` holds one implementation of the `Platform` interface per portal, chosen at build time
(`__PLATFORM__`, see `vite.config.ts`); the bundler drops the others.

- `web` — no SDK, no ads (optional extras are free).
- `crazygames` — CrazyGames SDK v3: loading / gameplay events around real play only, happytime on a solved board,
  midgame ads between boards only (no pre-roll), rewarded extras, Data Module saves, the platform mute setting and
  language. Each build bundles only its own SDK (checked in CI).
- `gd` — GameDistribution HTML5 SDK: `window.GD_OPTIONS = { gameId, onEvent }`, `main.min.js` loaded once while
  the game loads. `SDK_GAME_PAUSE` pauses and mutes, `SDK_GAME_START` resumes and restores the audio settings,
  `SDK_REWARDED_WATCH_COMPLETE` grants the reward. Interstitials only on user input outside play (Play = pre-roll,
  Next / Menu between boards, never before the 3rd board); rewarded ads only for an optional extra hint or
  shuffle / undo, or a rewarded Continue when stuck. Mid-roll interstitials are rate-limited to one per ~2 minutes
  (the pre-roll counts). No coins, no shop: monetization is ads only. Every ad request settles exactly once (completion, error / cancel, or nothing started within 8 s).
  If the SDK cannot load, the game stays fully playable. The game id is a build constant:
  `2708776451364ee68eca7c869f5371e0` (set in `vite.config.ts`, GD build only; `GD_GAME_ID=<id>` overrides it).
- `gamepix` — GamePix JS SDK v3 (`--mode gamepix`): the SDK `<script src>` with `lifecycle: 'manual'` is added to
  index.html in this build only, with a loading bar. `lifecycle.loading()` while booting, `await loaded()` before the
  menu, `gameStart()` once at the first board; `pause` / `resume` stop the clock, block input and mute / restore audio;
  interstitials between boards only (no pre-roll), rewarded extras granted only on `success === true`;
  `happyMoment('level_complete')`, `sadMoment('game_over')` at a real dead end; language from `GamePix.lang()`.
  GamePix allows no religious symbols, so this build alone swaps a few pictures for neutral garden ones (lotus ->
  tulip, pagoda -> bonsai, bell -> watering can, crescent moon -> snail, mooncake stamp, Classic lotus -> camellia;
  garden: stone lantern -> bench, pagoda -> willow, lotus -> water lilies; the cross-shaped board -> Lily Pad). All of
  it is behind `__PLATFORM__ === 'gamepix'` checks, so the other builds are byte-for-byte unchanged.

To add a portal (e.g. Samsung Instant Plays): add its name to `PLATFORMS` in `vite.config.ts`, implement
`Platform` and register it in `src/app/sdk.ts`.

Saves use localStorage with an in-memory fallback. No external links, no logins.

## Deploy

GitHub Pages is deployed from `main` only (`.github/workflows/deploy.yml`). CI runs lint, typecheck, unit tests
(rules, solver, catalog, GD ad wrapper with fake timers), both builds, the audit and the e2e tests of both builds
on every pull request.

See [CREDITS.md](CREDITS.md) for fonts.
