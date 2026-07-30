import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { es, ClaveTexto, BasePlural } from './es';
import { en } from './en';

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

function interpolar(plantilla: string, vars?: Vars): string {
  if (!vars) return plantilla;
  return plantilla.replace(/\{(\w+)\}/g, (original, nombre) =>
    vars[nombre] != null ? String(vars[nombre]) : original
  );
}

export const IdiomaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [idioma, setIdioma] = useState<Idioma>(detectarIdiomaInicial);

  useEffect(() => {
    document.documentElement.lang = idioma;
    document.title = DICCIONARIOS[idioma]['app.tituloDocumento'];
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
