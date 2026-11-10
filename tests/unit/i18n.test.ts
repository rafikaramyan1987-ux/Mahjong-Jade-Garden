import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { LANGS, STRINGS, langOf, pickLang } from '../../src/app/i18n';

describe('languages', () => {
  it('10 languages; every language file has every English key with its placeholders', () => {
    expect(LANGS).toEqual(['en', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'pl', 'tr', 'ru']);
    const en = STRINGS.en as Record<string, string>;
    for (const l of LANGS) {
      const d = STRINGS[l] as Record<string, string>;
      expect(Object.keys(d).sort(), l).toEqual(Object.keys(en).sort());
      for (const [k, v] of Object.entries(en)) for (const ph of v.match(/\{[a-z]+\}/g) ?? []) expect(d[k], `${l} ${k}`).toContain(ph);
    }
    // the same check as CI's `npm run check:i18n`
    expect(() => execFileSync('node', ['scripts/check-i18n.mjs'], { stdio: 'pipe' })).not.toThrow();
  });
  it('picks the saved language, then the portal locale, then the browser language, else English', () => {
    expect(langOf('pt-BR')).toBe('pt');
    expect(langOf('zh-CN')).toBeNull();
    expect(pickLang('ru', 'de-DE', ['fr'])).toBe('ru');
    expect(pickLang(null, 'de-DE', ['fr'])).toBe('de');
    expect(pickLang(null, null, ['ja-JP', 'nl-BE'])).toBe('nl');
    expect(pickLang(null, 'xx', [])).toBe('en');
    expect(pickLang('klingon', null, [])).toBe('en');
  });
});
