/**
 * Texts of the game: one JSON file per language in src/i18n/ (English is the reference; CI checks that every
 * language has every English key, `npm run check:i18n`). No text is written in the code.
 *
 * Language: the player's choice in Settings (saved) wins; otherwise the portal's language (CrazyGames SDK locale,
 * GamePix.lang()), otherwise the browser language (GameDistribution, web), otherwise English.
 */
import de from '../i18n/de.json';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import fr from '../i18n/fr.json';
import it from '../i18n/it.json';
import nl from '../i18n/nl.json';
import pl from '../i18n/pl.json';
import pt from '../i18n/pt.json';
import ru from '../i18n/ru.json';
import tr from '../i18n/tr.json';

export type StrKey = keyof typeof en;
export const LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'pl', 'tr', 'ru'] as const;
export type Lang = (typeof LANGS)[number];

/** each language's own name, for the language picker */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  es: 'Español',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  tr: 'Türkçe',
  ru: 'Русский',
};

export const STRINGS: Record<Lang, Partial<Record<StrKey, string>>> = { en, fr, de, it, es, pt, nl, pl, tr, ru };

/** names that the GamePix build replaces (neutral garden pieces and board shapes, see src/art/garden.ts) */
const GPX_KEYS = new Set<string>(['el.stoneLantern', 'el.pagoda', 'el.lotus', 'layout.pagoda', 'layout.lotus']);

export const isLang = (l: unknown): l is Lang => typeof l === 'string' && (LANGS as readonly string[]).includes(l);

/** "pt-BR" -> "pt"; anything we do not have -> null */
export function langOf(locale: string | null | undefined): Lang | null {
  if (!locale) return null;
  const base = locale.toLowerCase().replace('_', '-').split('-')[0];
  return isLang(base) ? base : null;
}

/** the language to start in: saved choice, then the portal's locale, then the browser's languages, then English */
export function pickLang(saved: string | null | undefined, portalLocale: string | null | undefined, browser: readonly string[] = []): Lang {
  if (isLang(saved)) return saved;
  const p = langOf(portalLocale);
  if (p) return p;
  for (const b of browser) {
    const l = langOf(b);
    if (l) return l;
  }
  return 'en';
}

export function browserLangs(): string[] {
  if (typeof navigator === 'undefined') return [];
  return [...(navigator.languages ?? []), navigator.language].filter(Boolean);
}

let lang: Lang = 'en';
export function setLang(l: Lang) {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}
export function getLang(): Lang {
  return lang;
}

export function t(k: StrKey, vars?: Record<string, string | number>): string {
  const key = (__PLATFORM__ === 'gamepix' && GPX_KEYS.has(k) ? `gpx.${k}` : k) as StrKey;
  let s = STRINGS[lang][key] ?? (en as Record<string, string>)[key] ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(String(b));
  return s;
}

/** letters on the Classic wind tiles (East, South, West, North) */
export function windLetters(): readonly string[] {
  const w = t('tile.winds');
  return w.length === 4 ? w.split('') : ['E', 'S', 'W', 'N'];
}
