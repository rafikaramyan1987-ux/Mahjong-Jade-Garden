# Mahjong Jade Garden — Y8 submission

- **App ID:** `6af4b118ca1c6869a74e0363` · **Game ID:** `292543` (both already in the build; checked in CI)
- **Hosting:** direct upload of the zip. This is a single-player game, so per docs.y8.com/studio/iframe-game-hosting
  it is uploaded to Y8 rather than iframe-hosted.

## Files to upload (which file goes in which Y8 slot)

| Y8 Studio tab → slot | File (in this folder) | Spec, checked by `scripts/y8/check.mjs` |
|---|---|---|
| **Builds** → upload | `mahjong-jade-garden-y8-v1.zip` | `index.html` at the zip root, one self-contained file, relative paths, ~320 KB |
| **Media** → Standard Screenshot (×4) | `media/screenshot-760x570-1.jpg` … `-4.jpg` | 760x570 JPG, < 2 MB |
| **Media** → Widescreen Screenshot (×4) | `media/screenshot-1280x720-1.jpg` … `-4.jpg` | 1280x720 JPG, < 5 MB |
| **Media** → Landscape Promo | `media/promo-landscape-1920x1080.jpg` | 1920x1080 JPG, < 5 MB |
| **Media** → Portrait Promo | `media/promo-portrait-1080x1920.jpg` | 1080x1920 JPG, < 5 MB |
| **Media** → Game Card Promo | `media/promo-card-760x570.jpg` | 760x570 JPG, < 2 MB |
| **Media** → Gameplay Video (16:9) | `media/gameplay-1280x720.mp4` | H.264 MP4 1280x720, 26 s, 5.6 MB |
| **Media** → Gameplay Video (4:3) | `media/gameplay-960x720.mp4` | H.264 MP4 960x720, 26 s, 4.5 MB, the same take |

Each screenshot shows the same moment at both sizes, laid out natively at that size:
1. Journey board 22 in play, with a tile picked
2. A combo (×4) on board 10
3. A cleared board with its stars and the garden element it restored
4. The Jade Garden journey map (spring, 9 of 16 elements restored)

The three promos are the game's cover art with the logo, rendered by the game at each size.

The video is one scripted take of real play, with no intro, menus or sound. Every move is a real click, and the game's
own hint solver picks the pair. It covers Journey board 10 from the first second: matches, a hint at about 4 s and
combos, then the board is cleared with 3 stars at about 13 s. That falls inside Y8's 20 s preview. After that, Next
starts board 11 and play continues to 26 s. The 960x720 clip is the same seeded take (same deal, same moves) recorded
at 4:3, so the whole board stays in frame.

## Basic info (ready to paste)

**Game name**
```
Mahjong Jade Garden
```

**Description**
```
A calm, classic Mahjong Solitaire in a sunny Chinese garden. Match pairs of identical free tiles - bright, glossy pictures of pandas, red pandas, koi, cranes, lotus flowers and red lanterns (the traditional Classic tiles are one tap away in Settings).

Journey: 64 hand-tuned boards from gentle to challenging. Every board you clear restores part of the Jade Garden - a stone lantern, a moon bridge, a koi pond, a pagoda - through spring, summer, autumn and winter. Replay any board to improve your stars and best time.

Daily Challenge: a new board every day, the same for everyone, with bronze, silver and gold medals and a day streak.

Quick matches chain into combos that win back time for your 3 stars. Every deal is guaranteed solvable, and Hint, Undo and Shuffle are there whenever you need them. Large, clear tiles, a colorblind-friendly option, soft music and no time limit make it a relaxing daily game. Progress is saved automatically. Plays in 10 languages.
```

**Instructions**
```
Click or tap two free tiles with the same picture to remove them. A tile is free when nothing lies on top of it and its left or right side is open (blocked tiles are shaded). Clear all the tiles to finish the board; finish faster for more stars.
Mouse: click tiles, mouse wheel to zoom. Keyboard: H hint, U undo, S shuffle, P pause.
Touch: tap tiles, pinch to zoom.
Hint, Undo and Shuffle buttons sit next to the board. If no moves are left, the game offers a shuffle.
```

**Supported platforms:** Desktop (mouse, keyboard) and mobile / tablet (touch). Portrait and landscape: the game fills
any frame. **Suggested size:** 1280x720.

**Languages:** English (default), French, German, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Turkish.

**Multiplayer:** no. **Login:** not required (guests play everything). **In-app purchases:** none.

**Category:** Puzzle (Mahjong, if offered). **Tags:**
```
mahjong, mahjong solitaire, solitaire, tiles, matching, pairs, puzzle, classic, relaxing, casual, brain, logic, garden, daily challenge, html5, mobile
```

## Ads in this build (Y8 SDK)

- The SDK comes only from Y8's CDN (`<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async>` in `<head>`)
  and is never bundled. Initialization follows the portal snippet exactly:
  1. a `y8sdk.ready` listener (once) calls `y8.sdk()`;
  2. then `init({ appId, autoLogin: true }, { gameId, preloadAdBreaks: 'on', sound: 'on', onReady })`;
  3. then `onAuth`.
  
  `window.y8.emitReadyEvent()` covers an SDK that loaded first. Guests can always play. No ad is requested before init.
- Interstitials:
  - `showAd({ type: 'start' })` on the player's first Play click;
  - `showAd({ type: 'next' })` on Next, Journey or Menu of a cleared board and on Restart (retry) in the pause menu.
  
  They never fire automatically or during play. The game adds no frequency cap of its own (the SDK paces them). If no
  ad is shown, the game continues at once.
- `beforeAd` pauses the game and silences it. `afterAd` resumes it and restores the player's audio settings. Each
  request settles exactly once: on `adBreakDone`, on `.catch()`, or on a timeout (nothing started within 8 s).
- Rewarded (`type: 'reward'`) ads are optional, for +1 hint, undo or shuffle, or a rewarded shuffle at a dead end. The
  panel explains the reward first ("Watch an ad: +1 hint").
  - `beforeReward` calls `showAdFn()`, and the reward is granted only in `adViewed`.
  - `adDismissed` gives nothing.
  - With no ad, the button says "No ad available right now, try later" and the game goes on.
  
  Nothing essential is behind ads.
- The game pauses and silences itself when the tab is hidden (`visibilitychange`) or the window loses focus (`blur`),
  and resumes when the player comes back.
- There are no other ad networks, external links or "More games" buttons. Saves stay in localStorage. With an ad
  blocker the game is fully playable, and the rewarded buttons are hidden.

## Rebuild

```sh
npm ci
npm run submission:y8   # vite --mode y8 → dist-y8/ → zip + checks (zip and media)
npm run test:e2e:y8     # Playwright smoke test of dist-y8 with a stubbed Y8 SDK
npm run media:y8        # screenshots, promos and both videos
```
