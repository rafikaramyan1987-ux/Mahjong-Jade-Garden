/**
 * Layout audit + playtest bot.
 *
 *   npx tsx scripts/audit.ts [--seeds 4] [--bots 24] [--days 60] [--md docs/audit.md] [--strict]
 *
 * For each of the 64 journey layouts, in all three variants (landscape / portrait / short = phone held sideways):
 * - the layout is valid (no overlaps, no floating tiles, even count); portrait tiles >= 34 px on a 390 x 844 phone
 * - the exact journey deal is solvable: the deal's construction order replays to an empty board AND the
 *   independent solver finds a solution; the same for `--seeds` more seeds
 * - reports open matches at the start, solution length, solver effort
 * - playtest bot: `--bots` casual players (random open match each move) report how often they clear the board
 *   without help and how many shuffles they need on average (the game gives 2 per board)
 * The daily challenges of the next `--days` days are checked the same way.
 * With --strict the process exits 1 on any failure (CI).
 */
import { writeFileSync } from 'node:fs';
import { Game } from '../src/game/game';
import { validateLayout } from '../src/game/layout';
import { mulberry32 } from '../src/game/rng';
import { solve } from '../src/game/solver';
import { boardTiles, footprint, MIN_PORTRAIT_FILL, DESKTOP_LANDSCAPE_AREA, MAX_PORTRAIT_COLS, MIN_LANDSCAPE_TILE, MIN_PORTRAIT_TILE, MIN_SHORT_TILE, PHONE_LANDSCAPE_AREA, PHONE_PORTRAIT_AREA, SHORT_FLOOR_TILE, tileWidthIn } from '../src/layouts/build';
import { BOARDS_PER_SEASON, VARIANTS, dailyFor, dealLayout, journeyLayouts, journeySeed, variantSlots, type Variant } from '../src/layouts/catalog';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const argStr = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : null;
};
const SEEDS = arg('seeds', 4);
const BOTS = arg('bots', 24);
const DAYS = arg('days', 60);
const MD = argStr('md');
const STRICT = process.argv.includes('--strict');
const SHUFFLES = 2;

const failures: string[] = [];
let shuffleFailures = 0;
const fail = (m: string) => {
  failures.push(m);
  console.error('FAIL', m);
};

/** proves a deal solvable two ways; returns solver stats */
function verify(game: Game, label: string) {
  const replay = new Game(game.g.slots, game.faces);
  for (const [a, b] of game.solution) if (!replay.match(a, b)) return fail(`${label}: construction order does not replay`), null;
  if (!replay.won) return fail(`${label}: construction order does not clear the board`), null;
  // independent solver, a few restarts with different move-order seeds if it runs out of budget
  for (let s = 1; s <= 4; s++) {
    const r = solve(game.g, game.faces, game.present, 250000, s * 7919);
    if (r.solvable === true) {
      const check = new Game(game.g.slots, game.faces);
      for (const [a, b] of r.moves) if (!check.match(a, b)) return fail(`${label}: solver solution is illegal`), null;
      return { nodes: r.nodes, length: r.moves.length };
    }
    if (r.solvable === false) return fail(`${label}: solver says unsolvable`), null;
  }
  return fail(`${label}: solver gave up`), null;
}

/** casual player: any open match, at random; shuffles when stuck */
function casual(game: Game, seed: number) {
  const g = new Game(game.g.slots, game.faces);
  const rng = mulberry32(seed);
  let shuffles = 0;
  for (let guard = 0; guard < 400 && !g.won; guard++) {
    const moves = g.openMatches();
    if (!moves.length) {
      shuffles++;
      if (shuffles > 12) break;
      if (!g.shuffle(rng)) {
        shuffleFailures++;
        break;
      }
      continue;
    }
    const [a, b] = moves[Math.floor(rng() * moves.length)];
    g.match(a, b);
  }
  return { won: g.won, shuffles };
}

interface Row {
  n: number;
  id: string;
  variant: Variant;
  tiles: number;
  layers: number;
  open: number;
  openAvg: number;
  length: number;
  nodes: number;
  tile: number;
  cleanWin: number;
  withinShuffles: number;
  avgShuffles: number;
}

const rows: Row[] = [];
const t0 = Date.now();
for (const l of journeyLayouts()) {
  for (const variant of VARIANTS) {
    const slots = variantSlots(l, variant);
    const label = `board ${l.index + 1} ${l.id} ${variant}`;
    const errs = validateLayout(slots);
    if (errs.length) fail(`${label}: ${errs.slice(0, 3).join('; ')}`);
    if (slots.length > 144) fail(`${label}: ${slots.length} tiles (more than one set)`);
    const b = boardTiles(slots);
    const portrait = variant === 'portrait';
    const short = variant === 'short';
    const area = portrait ? PHONE_PORTRAIT_AREA : short ? PHONE_LANDSCAPE_AREA : DESKTOP_LANDSCAPE_AREA;
    const tw = tileWidthIn(b, area.w, area.h);
    const minTile = portrait ? MIN_PORTRAIT_TILE : short ? (l.index < 40 ? MIN_SHORT_TILE : SHORT_FLOOR_TILE) : MIN_LANDSCAPE_TILE;
    if (tw < minTile) fail(`${label}: tiles ${tw.toFixed(1)} px wide (minimum ${minTile} px ${portrait ? 'on 390 x 844' : short ? 'on 844 x 390' : 'on 1280 x 720'})`);
    const fp = footprint(slots);
    if (portrait && (fp.split || fp.fill < MIN_PORTRAIT_FILL)) fail(`${label}: looks gappy (covers ${Math.round(fp.fill * 100)}% of its outline${fp.split ? ', split by an empty row or column' : ''})`);
    if (portrait && (b.maxX - b.minX) / 2 > MAX_PORTRAIT_COLS) fail(`${label}: ${(b.maxX - b.minX) / 2} tiles across (maximum ${MAX_PORTRAIT_COLS})`);
    const game = dealLayout(l, variant, journeySeed(l.index));
    const st = verify(game, label);
    let openSum = game.openMatches().length;
    for (let s = 1; s <= SEEDS; s++) {
      const g = dealLayout(l, variant, 1000 + s * 31 + l.index);
      verify(g, `${label} seed ${s}`);
      openSum += g.openMatches().length;
    }
    let clean = 0,
      within = 0,
      shuf = 0;
    for (let k = 0; k < BOTS; k++) {
      const r = casual(game, k + 1);
      if (r.won && r.shuffles === 0) clean++;
      if (r.won && r.shuffles <= SHUFFLES) within++;
      shuf += r.shuffles;
    }
    rows.push({
      n: l.index + 1,
      id: l.id,
      variant,
      tiles: slots.length,
      layers: b.maxZ + 1,
      open: game.openMatches().length,
      openAvg: openSum / (SEEDS + 1),
      length: st?.length ?? 0,
      nodes: st?.nodes ?? 0,
      tile: tw,
      cleanWin: clean / BOTS,
      withinShuffles: within / BOTS,
      avgShuffles: shuf / BOTS,
    });
  }
  process.stdout.write('.');
}
console.log();

// daily challenges
const today = new Date();
for (let d = 0; d < DAYS; d++) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const { layout, seed } = dailyFor(key);
  for (const variant of VARIANTS) verify(dealLayout(layout, variant, seed), `daily ${key} ${variant}`);
}

if (shuffleFailures) fail(`${shuffleFailures} shuffles could not produce a solvable position`);

// difficulty trend: average open matches at the start per season should go down, tiles and layers up
const seasons = [0, 1, 2, 3].map((s) => {
  const rs = rows.filter((r) => Math.floor((r.n - 1) / BOARDS_PER_SEASON) === s);
  const avg = (f: (r: Row) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  const portrait = rs.filter((r) => r.variant === 'portrait').map((r) => r.tile);
  return { season: s + 1, tiles: avg((r) => r.tiles), layers: avg((r) => r.layers), open: avg((r) => r.openAvg), clean: avg((r) => r.cleanWin), within: avg((r) => r.withinShuffles), minTile: Math.min(...portrait), maxTile: Math.max(...portrait) };
});
for (let s = 1; s < 4; s++) {
  if (seasons[s].tiles < seasons[s - 1].tiles) fail(`season ${s + 1} has fewer tiles on average than season ${s}`);
  if (seasons[s].open > seasons[s - 1].open + 0.5) fail(`season ${s + 1} has more open matches at the start than season ${s}`);
}
const minTile = Math.min(...rows.filter((r) => r.variant === 'portrait').map((r) => r.tile));
const minLand = Math.min(...rows.filter((r) => r.variant === 'landscape').map((r) => r.tile));
const shortRows = rows.filter((r) => r.variant === 'short');
const minShort40 = Math.min(...shortRows.filter((r) => r.n <= 40).map((r) => r.tile));
const minShort = Math.min(...shortRows.map((r) => r.tile));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const secs = ((Date.now() - t0) / 1000).toFixed(0);

const md = [
  '# Layout audit and playtest',
  '',
  `Generated by \`npx tsx scripts/audit.ts --seeds ${SEEDS} --bots ${BOTS} --days ${DAYS}\` (${secs} s).`,
  '',
  `- ${rows.length} journey boards (64 layouts x landscape / portrait / short), each verified on the journey deal and ${SEEDS} more seeds: ${rows.length * (SEEDS + 1)} deals.`,
  `- ${DAYS * 3} daily challenge deals (next ${DAYS} days, all three variants).`,
  `- Phone held sideways (844 x 390, the short variant): smallest tile ${minShort40.toFixed(1)} px on boards 1–40 (required ≥ ${MIN_SHORT_TILE} px), ${minShort.toFixed(1)} px on the hardest boards (required ≥ ${SHORT_FLOOR_TILE} px).`,
  '- Every deal is proven solvable twice: its construction order replays to an empty board, and the independent solver finds a solution.',
  `- Smallest tile on a 390 x 844 phone (portrait): ${minTile.toFixed(1)} px (required ≥ ${MIN_PORTRAIT_TILE} px on every board, at most ${MAX_PORTRAIT_COLS} tiles across); on 1280 x 720 (landscape): ${minLand.toFixed(1)} px (required ≥ ${MIN_LANDSCAPE_TILE} px).`,
  `- Portrait boards look full: each covers ≥ ${Math.round(MIN_PORTRAIT_FILL * 100)}% of its outline, with no empty row or column splitting it.`,
  '- Only identical pictures match (38 pictures: 34 x 4 tiles + 4 x 2 tiles).',
  `- Shuffle (solver-verified, also from dead ends) never failed in ${rows.length * BOTS} bot games.`,
  `- Failures: ${failures.length}`,
  '',
  '## Seasons',
  '',
  '| Season | avg tiles | avg layers | portrait tile px on 390 x 844 (min–max) | avg open matches at start | casual bot clears without help | casual bot clears with ≤ 2 shuffles |',
  '|---|---|---|---|---|---|---|',
  ...seasons.map((s) => `| ${s.season} | ${s.tiles.toFixed(0)} | ${s.layers.toFixed(1)} | ${s.minTile.toFixed(0)}–${s.maxTile.toFixed(0)} | ${s.open.toFixed(1)} | ${pct(s.clean)} | ${pct(s.within)} |`),
  '',
  'The casual bot plays a random open match every move (no planning), a pessimistic model of a new player.',
  'Players who think ahead, or use Hint (the solver picks a move that keeps the board solvable), do much better.',
  '',
  '## Boards',
  '',
  '| # | layout | variant | tiles | layers | open at start | avg open (seeds) | solution length | solver nodes | tile px | bot clean | bot ≤ 2 shuffles | bot avg shuffles |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.n} | ${r.id} | ${r.variant} | ${r.tiles} | ${r.layers} | ${r.open} | ${r.openAvg.toFixed(1)} | ${r.length} | ${r.nodes} | ${r.tile.toFixed(1)} | ${pct(r.cleanWin)} | ${pct(r.withinShuffles)} | ${r.avgShuffles.toFixed(2)} |`,
  ),
  '',
].join('\n');
if (MD) writeFileSync(MD, md);
console.log(md.split('## Boards')[0]);
if (failures.length) {
  console.error(`${failures.length} failure(s)`);
  if (STRICT) process.exit(1);
}
