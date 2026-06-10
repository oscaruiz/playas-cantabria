import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { es, ClaveTexto, BasePlural } from './es';
import { en } from './en';

export type Idioma = 'es' | 'en';

const IDIOMA_KEY = 'app_idioma';

const DICCIONARIOS: Record<Idioma, Record<ClaveTexto, string>> = { es, en };

type Vars = Record<string, string | number>;

/** Firma de t(), útil para helpers que la reciben como parámetro. */
export type TraducirFn = (clave: ClaveTexto, vars?: Vars) => string;

interface IdiomaContextValue {
  idioma: Idioma;
  setIdioma: (idioma: Idioma) => void;
  /** Traduce una clave, con interpolación de {variables}. */
  t: TraducirFn;
  /** Resuelve la forma plural (`_one`/`_other`) según count. */
  tPlural: (base: BasePlural, count: number) => string;
}

const IdiomaContext = createContext<IdiomaContextValue | null>(null);

/** Idioma guardado, o el del navegador la primera vez. */
export function detectarIdiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem(IDIOMA_KEY);
    if (guardado === 'es' || guardado === 'en') return guardado;
  } catch {
    /* localStorage no disponible */
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
      /* localStorage no disponible */
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
