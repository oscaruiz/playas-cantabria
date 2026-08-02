import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { es, ClaveTexto, BasePlural } from './es';
import { en } from './en';
import { REGION } from '../config/region';

export type Idioma = 'es' | 'en';

const IDIOMA_KEY = 'app_idioma';

const DICCIONARIOS: Record<Idioma, Record<ClaveTexto, string>> = { es, en };

type Vars = Record<string, string | number>;

/** Signature of t(), useful for helpers that receive it as a parameter. */
export type TraducirFn = (clave: ClaveTexto, vars?: Vars) => string;

interface IdiomaContextValue {
  idioma: Idioma;
  setIdioma: (idioma: Idioma) => void;
  /** Translates a key, with {variables} interpolation. */
  t: TraducirFn;
  /** Resolves the plural form (`_one`/`_other`) according to count. */
  tPlural: (base: BasePlural, count: number) => string;
}

const IdiomaContext = createContext<IdiomaContextValue | null>(null);

/** Saved language, or the browser's the first time. */
export function detectarIdiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem(IDIOMA_KEY);
    if (guardado === 'es' || guardado === 'en') return guardado;
  } catch {
    /* localStorage not available */
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

/**
 * `{region}` is always available without the call sites passing it: it is a
 * property of the build, not of each screen. That is what lets the titles and
 * subtitles be the same key in every region.
 */
const VARS_IMPLICITAS: Vars = { region: REGION.name };

function interpolar(plantilla: string, vars?: Vars): string {
  const todas = vars ? { ...VARS_IMPLICITAS, ...vars } : VARS_IMPLICITAS;
  return plantilla.replace(/\{(\w+)\}/g, (original, nombre) =>
    todas[nombre] != null ? String(todas[nombre]) : original
  );
}

export const IdiomaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [idioma, setIdioma] = useState<Idioma>(detectarIdiomaInicial);

  useEffect(() => {
    document.documentElement.lang = idioma;
    // The title is no longer set here: each page owns it via SeoHead
    // (src/seo/SeoHead.tsx). A provider-level title would overwrite the
    // page's one on every language switch, because parent effects run
    // after child effects.
    try {
      localStorage.setItem(IDIOMA_KEY, idioma);
    } catch {
      /* localStorage not available */
    }
  }, [idioma]);

  const t = useCallback(
    (clave: ClaveTexto, vars?: Vars) => {
      const plantilla = DICCIONARIOS[idioma][clave] ?? es[clave];
      return interpolar(plantilla, vars);
    },
    [idioma]
  );

  const tPlural = useCallback(
    (base: BasePlural, count: number) => {
      const clave = `${base}_${count === 1 ? 'one' : 'other'}` as ClaveTexto;
      const plantilla = DICCIONARIOS[idioma][clave] ?? es[clave];
      return interpolar(plantilla, { count });
    },
    [idioma]
  );

  return (
    <IdiomaContext.Provider value={{ idioma, setIdioma, t, tPlural }}>
      {children}
    </IdiomaContext.Provider>
  );
};

export function useIdioma(): IdiomaContextValue {
  const ctx = useContext(IdiomaContext);
  if (!ctx) throw new Error('useIdioma debe usarse dentro de <IdiomaProvider>');
  return ctx;
}
