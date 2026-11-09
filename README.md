# Mahjong Jade Garden

A calm, classic Mahjong Solitaire for web game portals (GameDistribution first, more portals later).
Traditional ivory tiles on deep jade felt, a quiet Chinese garden around the table, and a light “Jade Garden”
journey: every cleared board restores one part of the garden, across four seasons.

TypeScript + Vite, everything (code, fonts, art) in one `index.html`. No external requests except the portal SDK
in portal builds.

## Play

- A tile is **free** when nothing lies on top of it and its left or right side is open.
- Tap two identical free tiles to remove them. Any flower matches any flower, any season any season.
- Clear the board. **Hint**, **Undo** and **Shuffle** are below the board (right side in landscape); there is no
  time limit — the clock only counts toward the score and stars.

Every deal is solvable: boards are dealt by reverse construction (the removal order is a proof), and an
independent solver re-checks every journey deal and the daily challenges in CI (`npm run audit`). Shuffle re-deals
the remaining tiles the same way, so it always leaves a solvable board.

## Journey, daily challenge, balance

- **64 boards** (`src/layouts/catalog.ts`): 16 shapes x 4 seasons. Along the journey the tile count grows
  (≈ 64 → 144), stacks get taller and deals get harder (fewer open matches at the start: from 9.1 to 6.2 on
  average). Board 16 of every season is the classic Jade Turtle (144 tiles).
- **Two variants per layout**: a wide one and a tall one. The game uses whichever gives bigger tiles on the
  current screen, so on a 390 x 844 phone tiles are 39–62 px wide (minimum 34 px, checked in the audit and in e2e).
- **Jade Garden**: each cleared journey board restores one of 16 garden elements; one season per 16 boards.
- **Daily challenge**: one deal per date (a mid-journey layout), with a streak.
- **Statistics**: journey progress, boards played / cleared, win rate, best and average time, best score, tiles
  matched, stars, daily streak. Stars: 3 = no hint and fast, 2 = up to 2 hints or a steady pace, 1 = cleared.
- **Help per board**: 3 hints, 2 shuffles, unlimited undo; one more hint or shuffle for an optional rewarded ad.
  The playtest bot (a player who takes a random open match every move) clears 97–98% of boards with at most
  2 shuffles, so the free allowance is enough; see [docs/audit.md](docs/audit.md).

## Accessibility

Large tiles that fill the screen (in tall portrait screens the board turns a quarter for bigger tiles), shaded
blocked tiles (“highlight free tiles”, on by default), optional colorblind-friendly suits with corner indices,
pinch / wheel zoom, readable fonts (18–24 px UI), no time pressure, reduced-motion support. English and French.

## Develop

```sh
npm install
npm run dev            # http://localhost:5173  (?fresh = ignore the save, ?seed=N = fixed deal, ?lang=fr)
npm run lint && npm run typecheck && npm test
npm run build          # web build  -> dist/index.html     (GitHub Pages)
npm run build:gd       # GD build   -> dist-gd/index.html  (VITE_PLATFORM=gd also works)
npm run test:e2e       # Playwright smoke tests on the web build (1280x720 and 390x844, portrait tile size)
npm run test:e2e:gd    # the GD build with a mocked SDK (ad rules, rewards, no-SDK fallback)
npm run audit          # layout audit + playtest bot -> docs/audit.md (CI fails on any unsolvable deal)
npm run submission:gd  # submission-gd/: zip (index.html at the root), JPG thumbnails, screenshots
node scripts/art.mjs   # store / review images from the real game -> docs/art
node scripts/record.mjs # gameplay recordings -> docs/media
```

## Platforms

`src/app/platform/` holds one implementation of the `Platform` interface per portal, chosen at build time
(`__PLATFORM__`, see `vite.config.ts`); the bundler drops the others.

- `web` — no SDK, no ads (optional extras are free).
- `gd` — GameDistribution HTML5 SDK: `window.GD_OPTIONS = { gameId, onEvent }`, `main.min.js` loaded once while
  the game loads. `SDK_GAME_PAUSE` pauses and mutes, `SDK_GAME_START` resumes and restores the audio settings,
  `SDK_REWARDED_WATCH_COMPLETE` grants the reward. Interstitials only on user input outside play (Play = pre-roll,
  Next / Menu between boards, never before the 3rd board); rewarded ads only for an optional extra hint or
  shuffle. Every ad request settles exactly once (completion, error / cancel, or nothing started within 8 s).
  If the SDK cannot load, the game stays fully playable. The game id is a build constant:
  `GD_GAME_ID=<id> npm run build:gd` (placeholder `TODO_GD_GAME_ID`).

To add a portal (e.g. Samsung Instant Plays): add its name to `PLATFORMS` in `vite.config.ts`, implement
`Platform` and register it in `src/app/sdk.ts`.

Saves use localStorage with an in-memory fallback. No external links, no logins.

## Deploy

GitHub Pages is deployed from `main` only (`.github/workflows/deploy.yml`). CI runs lint, typecheck, unit tests
(rules, solver, catalog, GD ad wrapper with fake timers), both builds, the audit and the e2e tests of both builds
on every pull request.

See [CREDITS.md](CREDITS.md) for fonts.
