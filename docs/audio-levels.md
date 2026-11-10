# Audio levels

Measured by `node scripts/audio-levels.mjs`: every effect rendered offline by the game (Web Audio, as played in the game,
through `SFX_LEVEL` and its own `SFX_GAIN`), loudness = the loudest 300 ms window (RMS, dBFS). Music = the average over
20 s at `MUSIC_LEVEL`. Effects stay within ±2 dB of each other; music plays 10–16 dB under them.

| effect | loudness (dBFS) | vs. median | gain to centre |
|---|---|---|---|
| select | -27.0 | -0.9 | 1.11 |
| match | -25.5 | +0.6 | 0.94 |
| mismatch | -27.0 | -0.9 | 1.12 |
| shuffle | -26.0 | +0.1 | 0.99 |
| hint | -25.9 | +0.1 | 0.99 |
| win | -25.0 | +1.0 | 0.89 |
| button | -27.0 | -1.0 | 1.12 |
| undo | -27.0 | -1.0 | 1.12 |
| restore | -26.0 | -0.0 | 1.00 |
| star | -26.0 | +0.0 | 0.99 |
| combo | -26.0 | +0.0 | 1.00 |

| music | loudness (dBFS) | under the effects |
|---|---|---|
| Morning Tea | -36.9 | 10.8 dB |
| Lantern Walk | -37.2 | 11.2 dB |

All effects within ±2 dB; both tracks 10–16 dB under the effects.
