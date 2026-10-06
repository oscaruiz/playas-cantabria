import { SEO_TEMPLATES, ATTR_LABELS, fillTemplate } from './metadata';
import { es } from '../i18n/es';

describe('fillTemplate', () => {
  it('interpolates with the same {var} syntax as the app', () => {
    expect(fillTemplate('{nombre} en {region}', { nombre: 'Amio', region: 'Cantabria' })).toBe(
      'Amio en Cantabria'
    );
  });

  it('leaves a placeholder without a variable intact, never empties it', () => {
    expect(fillTemplate('Hola {quien}', {})).toBe('Hola {quien}');
  });
});

describe('a single source of SEO templates', () => {
  it('the seo.* keys of the Spanish dictionary ARE the shared templates', () => {
    // Identity, not equality: if someone re-declares the string in es.ts,
    // the prerendered HTML and the app drift apart silently.
    expect(es['seo.tituloDetalle']).toBe(SEO_TEMPLATES.tituloDetalle);
    expect(es['seo.descDetalle']).toBe(SEO_TEMPLATES.descDetalle);
    expect(es['seo.tituloInicio']).toBe(SEO_TEMPLATES.tituloInicio);
    expect(es['seo.tituloLista']).toBe(SEO_TEMPLATES.tituloLista);
  });

  it('attribute labels are shared too', () => {
    expect(es['attr.duchas']).toBe(ATTR_LABELS.duchas);
    expect(es['attr.accesoBanista']).toBe(ATTR_LABELS.accesoBanista);
  });
});
