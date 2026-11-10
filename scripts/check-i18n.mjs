// Every language file has every English key (and no others), keeps every {placeholder} of the English text, and
// has no empty strings. `npm run check:i18n` (CI). Exits 1 on any problem.
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'src/i18n';
const LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'pl', 'tr', 'ru'];
const read = (l) => JSON.parse(readFileSync(`${DIR}/${l}.json`, 'utf8'));
const en = read('en');
const keys = Object.keys(en);
const problems = [];
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
for (const l of LANGS) if (!files.includes(l)) problems.push(`${l}: missing file ${DIR}/${l}.json`);
for (const l of files.filter((f) => f !== 'en')) {
  let d;
  try {
    d = read(l);
  } catch (e) {
    problems.push(`${l}: not valid JSON (${e.message})`);
    continue;
  }
  for (const k of keys) {
    if (!(k in d)) problems.push(`${l}: missing "${k}"`);
    else if (typeof d[k] !== 'string' || !d[k].trim()) problems.push(`${l}: empty "${k}"`);
    else for (const ph of en[k].match(/\{[a-z]+\}/g) ?? []) if (!d[k].includes(ph)) problems.push(`${l}: "${k}" lacks ${ph}`);
  }
  for (const k of Object.keys(d)) if (!(k in en)) problems.push(`${l}: unknown key "${k}"`);
}
// every non-Latin character of the translations has a glyph in the bundled extra fonts (scripts/fonts-ext.py)
const css = readFileSync('src/ui/fonts-ext.css', 'utf8');
const covered = new Set([...css.matchAll(/U\+([0-9A-F]{4})/g)].map((m) => parseInt(m[1], 16)));
const latin = (o) => o <= 0xff || (o >= 0x2000 && o <= 0x206f) || [0x131, 0x152, 0x153, 0x2bb, 0x2bc, 0x2c6, 0x2da, 0x2dc, 0x20ac, 0x2122, 0x2212, 0x2215].includes(o);
for (const l of files) {
  for (const v of Object.values(read(l))) for (const ch of v) {
    const o = ch.codePointAt(0);
    if (!latin(o) && !covered.has(o)) problems.push(`${l}: "${ch}" (U+${o.toString(16).toUpperCase()}) has no glyph in src/ui/fonts-ext.css: run python3 scripts/fonts-ext.py`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem(s) in the translations`);
  process.exit(1);
}
console.log(`i18n ok: ${files.length} languages x ${keys.length} keys`);
