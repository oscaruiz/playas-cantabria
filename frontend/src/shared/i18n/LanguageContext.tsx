import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { es, TextKey, BasePlural } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/es';
import { en } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/en';
import { REGION } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/config/region';

export type Language = 'es' | 'en';

const LANGUAGE_KEY = 'app_idioma';

const DICTIONARIES: Record<Language, Record<TextKey, string>> = { es, en };

type Vars = Record<string, string | number>;

/** Signature of t(), useful for helpers that receive it as a parameter. */
export type TranslateFn = (key: TextKey, vars?: Vars) => string;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Translates a key, with {variables} interpolation. */
  t: TranslateFn;
  /** Resolves the plural form (`_one`/`_other`) according to count. */
  tPlural: (base: BasePlural, count: number) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Saved language, or Spanish the first time. */
export function detectInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* localStorage not available */
  }
  // Deliberately NOT navigator.language: Googlebot renders with an en-US
  // browser and no saved preference, so browser detection made Google index
  // the English titles/metas for the Spanish URLs (seen 19-aug-2026).
  return 'es';
}

/**
 * `{region}` and `{marca}` are always available without the call sites passing
 * them: they are properties of the build, not of each screen. That is what
 * lets the titles and subtitles be the same key in every region, each with its
 * own brand name from region.json.
 */
const IMPLICIT_VARS: Vars = { region: REGION.name, marca: REGION.branding.appName };

function interpolate(template: string, vars?: Vars): string {
  const all = vars ? { ...IMPLICIT_VARS, ...vars } : IMPLICIT_VARS;
  return template.replace(/\{(\w+)\}/g, (original, name) =>
    all[name] != null ? String(all[name]) : original
  );
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(detectInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    // The title is no longer set here: each page owns it via SeoHead
    // (src/shared/seo/SeoHead.tsx). A provider-level title would overwrite the
    // page's one on every language switch, because parent effects run
    // after child effects.
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      /* localStorage not available */
    }
  }, [language]);

  const t = useCallback(
    (key: TextKey, vars?: Vars) => {
      const template = DICTIONARIES[language][key] ?? es[key];
      return interpolate(template, vars);
    },
    [language]
  );

  const tPlural = useCallback(
    (base: BasePlural, count: number) => {
      const key = `${base}_${count === 1 ? 'one' : 'other'}` as TextKey;
      const template = DICTIONARIES[language][key] ?? es[key];
      return interpolate(template, { count });
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tPlural }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useIdioma debe usarse dentro de <IdiomaProvider>');
  return ctx;
}
