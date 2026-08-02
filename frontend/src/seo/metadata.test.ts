import { PLANTILLAS_SEO, ETIQUETAS_ATTR, rellenar } from './metadata';
import { es } from '../i18n/es';

describe('rellenar', () => {
  it('interpola con la misma sintaxis {var} que la app', () => {
    expect(rellenar('{nombre} en {region}', { nombre: 'Amio', region: 'Cantabria' })).toBe(
      'Amio en Cantabria'
    );
  });

  it('deja intacto un placeholder sin variable, nunca lo vacía', () => {
    expect(rellenar('Hola {quien}', {})).toBe('Hola {quien}');
  });
});

describe('una sola fuente de plantillas SEO', () => {
  it('las claves seo.* del diccionario español SON las plantillas compartidas', () => {
    // Identity, not equality: if someone re-declares the string in es.ts,
    // the prerendered HTML and the app drift apart silently.
    expect(es['seo.tituloDetalle']).toBe(PLANTILLAS_SEO.tituloDetalle);
    expect(es['seo.descDetalle']).toBe(PLANTILLAS_SEO.descDetalle);
    expect(es['seo.tituloInicio']).toBe(PLANTILLAS_SEO.tituloInicio);
    expect(es['seo.tituloLista']).toBe(PLANTILLAS_SEO.tituloLista);
  });

  it('las etiquetas de atributos también se comparten', () => {
    expect(es['attr.duchas']).toBe(ETIQUETAS_ATTR.duchas);
    expect(es['attr.accesoBanista']).toBe(ETIQUETAS_ATTR.accesoBanista);
  });
});
