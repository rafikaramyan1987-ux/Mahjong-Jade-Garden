# Mahjong Jade Garden

A calm, classic Mahjong Solitaire for web game portals (GameDistribution first, more portals later).
Bright illustrated ivory tiles (or the traditional Classic set) on warm jade felt, a quiet Chinese garden around the table, and a light “Jade Garden”
journey: every cleared board restores one part of the garden, across four seasons.

TypeScript + Vite, everything (code, fonts, art) in one `index.html`; a small loading screen with a progress bar paints
first (the bundle sits at the end of the file). No external requests except the portal SDK in portal builds.

## Play

- A tile is **free** when nothing lies on top of it and its left or right side is open.
- Tap two free tiles with exactly the same picture to remove them. Only identical pictures match.
- Clear the board. **Hint**, **Undo** and **Shuffle** are below the board (right side in landscape); there is no
  time limit — the clock (it starts with the first tap) only counts toward the score and stars.
- **Combos:** matches within 3 s of each other build a multiplier (x2 … x5): more points per match and 1 s back on
  the star clock per combo match, with a small animated label and a chime that climbs.
- **Stars:** 3 when the board is cleared within 4 s per tile (minus the combo seconds), 2 within 7 s per tile, else 1.
  The bar on top always shows tiles left, a progress bar and the star target (stars still in reach and the time left).
- Optional keys (by physical key, `KeyboardEvent.code`, QWERTY and AZERTY alike): **H** hint, **U** undo, **S** shuffle,
  **P** pause. Escape and Ctrl / Cmd are never used.

**First minute.** A brand-new player is in board 1 right after the loading screen — no text pages. The tutorial is
inside the board, one short line per step: a hand shows two identical free tiles, one blocked tile is marked once
with the reason, then the helpers are pointed out. "Skip" ends it; it never comes back. Boards 1–3 have 18–24 tiles
(under a minute each).

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
- **Three variants per layout**: a wide one, a tall one (at most 6 tiles across) and a short one for phones held
  sideways (few rows, more layers, about the same tile count). The game uses whichever gives bigger tiles on the
  current screen, and the board fills the screen (8 px side margins). Tiles are at least 56 px wide on a 390 x 844
  phone and 64 px on 1280 x 720 on every board, and at least 56 px on 844 x 390 up to board 40 (44 px on the hardest
  boards) (audit, unit and e2e checks). Settings → Tile size → Large starts each board zoomed in (drag to move).
- **Jade Garden**: each cleared journey board restores one of 16 garden elements; one season per 16 boards.
- **Journey screen** (from the main menu and the result screen): per season, the garden as it is now — it blooms as
  boards are finished (the newest element grows in when you arrive after a win) — and its 16 boards with stars and
  best time, the next board highlighted and later boards locked. Later seasons' art is drawn only when scrolled to. Any finished board
  can be replayed (same deal); replays only improve the best stars / time. Continue always opens the next board.
- **Daily challenge**: the same board for everyone each day (seeded by the date, no server), a personal best time,
  bronze / silver / gold medals by time (gold ≤ 3 s per tile, silver ≤ 5 s), a streak ("5 days in a row") with a
  gentle reminder on the main menu.
- **Statistics**: boards finished, total stars, best daily time, current and longest daily streak, boards played /
  cleared, win rate, best and average time, best score, tiles matched. Stars: 3 = no hint and fast, 2 = up to 2 hints or a steady pace, 1 = cleared.
- **Help per board**: 3 hints, 2 shuffles, 5 undos. When one runs out its button shows a TV badge and offers "Watch
  an ad: +1 hint" (rewarded, always optional). When no pairs are left, Shuffle is offered automatically and is free
  once per board; then the board's shuffles; then a rewarded shuffle.
  The playtest bot (a player who takes a random open match every move) clears 99–100% of boards with at most
  2 shuffles, so the free allowance is enough; see [docs/audit.md](docs/audit.md).

## Music and sound

Two composed tracks generated in code (`src/app/music.ts`), alternating seamlessly (they are scheduled bar by bar,
so the loops are exact): **Morning Tea** (C major
pentatonic, 96 bpm: bamboo flute, guzheng, woodblock) and **Lantern Walk** (G major pentatonic, 108 bpm: pipa,
flute answers, light percussion). Every effect is balanced to the same loudness (±2 dB) and the music sits 10–16 dB under them, measured offline from
the game's own audio (`npm run audio:levels`, checked in CI, see [docs/audio-levels.md](docs/audio-levels.md)).
Matches ring a bright chime that climbs with combos; a tile that cannot be taken gets a soft shake and a gentle boop.
What can be heard is one pure function (`audioGate` in `src/app/audio.ts`): the player's Music / Sounds switches, the
portal's mute (CrazyGames muteAudio, GamePix soundOff), a pause or an ad, and a hidden tab. 30 s samples:
`docs/media/music-*.mp3` (`node scripts/music-samples.mjs`).

## Accessibility

Large tiles that fill the screen (tall portrait variants of every layout), bright pictures that differ in shape
and colour, shaded blocked tiles (“highlight free tiles”, on by default), optional colorblind-friendly suits with
corner indices for the Classic set,
pinch / wheel zoom and a large-tile setting, readable fonts (18–24 px UI), no time pressure, reduced-motion support.

## Languages

English, French, German, Italian, Spanish, Portuguese, Dutch, Polish, Turkish and Russian: one JSON file per language
in `src/i18n/` (English is the reference), no text in the code. The language comes from the player's choice in
Settings (saved), else the portal (CrazyGames SDK locale, `GamePix.lang()`), else the browser language (GD, web), else
English. `npm run check:i18n` (CI) checks that every file has every English key and placeholder and that the bundled
extra fonts cover every character; `tests/e2e/textfit.spec.ts` checks that every text fits in every language at
390 x 844 and 1920 x 1080. Polish / Turkish / Russian glyphs are subset to the characters used
(`python3 scripts/fonts-ext.py`, about 40 KB).

## Develop

```sh
npm install
npm run dev            # http://localhost:5173  (?fresh = ignore the save, ?seed=N = fixed deal, ?lang=de, ?menu = main menu first)
npm run lint && npm run typecheck && npm test
npm run build          # web build  -> dist/index.html     (GitHub Pages)
npm run build:gd       # GD build   -> dist-gd/index.html  (VITE_PLATFORM=gd also works)
npm run build:crazygames # CrazyGames build -> dist-crazygames/index.html (VITE_PLATFORM=crazygames)
npm run build:gamepix  # GamePix build -> dist-gamepix/index.html (VITE_PLATFORM=gamepix; neutral art, see below)
npm run build:playgama # Playgama build -> dist-playgama/ (index.html + Playgama Bridge 2.4.1 + its config; VITE_PLATFORM=playgama)
npm run submission:web # ad-free web zip for open portals -> submission-web/ (see submission-web/README.md)
npm run test:e2e       # Playwright tests on the web build (1280x720 and 390x844; tutorial, combos, settings, text fit in 10 languages)
npm run check:i18n     # every language file has every English key; the fonts cover every character
npm run audio:levels   # loudness of every sound and both tracks -> docs/audio-levels.md (run after a build)
node scripts/trailer.mjs       # CrazyGames trailers 1920x1080 + videos/1080x1620 (cover first, real play, ~18 s, no sound)
node scripts/first-minute.mjs  # docs/media/first-minute-v2-390x844.mp4: the first 60 s of a new player
npm run test:e2e:gd    # the GD build with a mocked SDK (ad rules, rewards, no-SDK fallback)
npm run test:e2e:cg    # the CrazyGames build with a mocked SDK v3 (lifecycle, ads, Data Module, no-SDK fallback)
npm run audit          # layout audit + playtest bot -> docs/audit.md (CI fails on any unsolvable deal)
npm run audit:gamepix  # the same audit on the GamePix build's board shapes
npm run submission:gamepix # submission-gamepix/: zip, icon, cover, gameplay video (GamePix SDK local simulator)
npm run submission:gd  # submission-gd/: zip (index.html at the root), JPG thumbnails, screenshots
npm run submission:crazygames # submission/: zip (folder/index.html), covers, ~18 s trailers (1920x1080, videos/1080x1620)
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

- `playgama` — Playgama Bridge 2.4.1 (`--mode playgama`, vendored in `vendor/playgama-bridge/`, loaded as the first
  script in `<head>`): `bridge.initialize()` before the save is read, language from `platform.language`, the save in
  Bridge Storage only (no localStorage), `game_ready` after the loading screen, interstitials between boards only,
  rewarded extras only after Bridge's `rewarded` state (hidden when Bridge has none), pause / audio state handled.
  Everything is behind `__PLATFORM__ === 'playgama'` checks; see submission-playgama/README.md.

To add a portal (e.g. Samsung Instant Plays): add its name to `PLATFORMS` in `vite.config.ts`, implement
`Platform` and register it in `src/app/sdk.ts`.

Saves use localStorage with an in-memory fallback. No external links, no logins.

## Deploy

GitHub Pages is deployed from `main` only (`.github/workflows/deploy.yml`). CI runs lint, typecheck, unit tests
(rules, solver, catalog, GD ad wrapper with fake timers), both builds, the audit and the e2e tests of both builds
on every pull request.

See [CREDITS.md](CREDITS.md) for fonts.
