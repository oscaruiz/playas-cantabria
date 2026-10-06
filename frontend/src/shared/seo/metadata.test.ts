import { SEO_TEMPLATES, ATTR_LABELS, fillTemplate } from './metadata';
import { es } from '../i18n/es';

describe('fillTemplate', () => {
  it('interpola con la misma sintaxis {var} que la app', () => {
    expect(fillTemplate('{nombre} en {region}', { nombre: 'Amio', region: 'Cantabria' })).toBe(
      'Amio en Cantabria'
    );
  });

  it('deja intacto un placeholder sin variable, nunca lo vacía', () => {
    expect(fillTemplate('Hola {quien}', {})).toBe('Hola {quien}');
  });
});

describe('una sola fuente de plantillas SEO', () => {
  it('las claves seo.* del diccionario español SON las plantillas compartidas', () => {
    // Identity, not equality: if someone re-declares the string in es.ts,
    // the prerendered HTML and the app drift apart silently.
    expect(es['seo.tituloDetalle']).toBe(SEO_TEMPLATES.tituloDetalle);
    expect(es['seo.descDetalle']).toBe(SEO_TEMPLATES.descDetalle);
    expect(es['seo.tituloInicio']).toBe(SEO_TEMPLATES.tituloInicio);
    expect(es['seo.tituloLista']).toBe(SEO_TEMPLATES.tituloLista);
  });

  it('las etiquetas de atributos también se comparten', () => {
    expect(es['attr.duchas']).toBe(ATTR_LABELS.duchas);
    expect(es['attr.accesoBanista']).toBe(ATTR_LABELS.accesoBanista);
  });
});
