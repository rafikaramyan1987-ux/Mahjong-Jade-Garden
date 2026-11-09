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

Every deal is solvable: boards are dealt by reverse construction (the removal order is a proof), and a separate
solver re-checks deals in the unit tests. Shuffle re-deals the remaining tiles the same way, so it always leaves
a solvable board.

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
npm run test:e2e       # Playwright smoke tests on the web build (1280x720 and 390x844)
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

GitHub Pages is deployed from `main` only (`.github/workflows/deploy.yml`). CI runs lint, typecheck, unit tests,
both builds and the e2e smoke tests on every pull request.

See [CREDITS.md](CREDITS.md) for fonts.
