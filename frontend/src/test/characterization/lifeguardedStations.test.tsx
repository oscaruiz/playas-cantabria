/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Este fichero vivía en `known-issues/` con un diagnóstico equivocado. Queda aquí
 * la versión correcta, ya con el arreglo aplicado.
 *
 * El defecto era una INCONSISTENCIA entre los dos orígenes de datos, no una
 * ausencia permanente del badge:
 *
 *  - `src/data/beaches.json` (el fallback local) es el fichero CRUDO del
 *    repositorio: 32 de las 46 playas solo traen `cruzRojaStations` y no traen
 *    `idCruzRoja`.
 *  - El backend sí deriva el id del primer puesto
 *    (`JsonBeachRepository.mapToEntity`), así que por la API esas 32 llegan con
 *    `idCruzRoja > 0`. Verificado contra el desplegado: 42 de 46 con id, y
 *    La Concha con `idCruzRoja: 373`.
 *
 * Como la interfaz solo miraba `idCruzRoja`, el badge salía con el backend y
 * faltaba durante la ventana de 2,5 s del arranque en frío (y toda la caída, si
 * la había): 32 badges aparecían de golpe al llegar `onBackendData`.
 *
 * El arreglo es `vigilanciaDisponible()`, que mira las dos fuentes. La propiedad
 * que fija este fichero es la EQUIVALENCIA entre ambos caminos.
 *
 * EL ORDEN DE LOS TESTS IMPORTA: `services/api.ts` cachea 5 min en una variable
 * de módulo y solo escribe en caso de éxito, así que los casos de backend caído
 * van ANTES del único que responde bien. Desaparece en F2, cuando la caché sea
 * inyectable.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import beachesJson from '../../data/beaches.json';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

interface EntradaJson {
  nombre: string;
  idCruzRoja?: number;
  cruzRojaStations?: unknown[];
}

function badgeDe(container: HTMLElement, nombre: string): Element | null {
  const card = Array.from(container.querySelectorAll('.beach-card')).find(
    (c) => c.querySelector('.beach-card-name')?.textContent === nombre,
  ) as HTMLElement | undefined;
  if (!card) throw new Error(`No hay tarjeta para ${nombre}`);
  return card.querySelector('.badge-vigilada');
}

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
});

it('el JSON empaquetado reparte la vigilancia entre dos campos distintos', () => {
  const playas = beachesJson as EntradaJson[];

  const conId = playas.filter((p) => (p.idCruzRoja ?? 0) > 0);
  const soloConPuestos = playas.filter(
    (p) => (p.idCruzRoja ?? 0) === 0 && (p.cruzRojaStations?.length ?? 0) > 0,
  );

  // Invariante sobre la salida de `sync-beaches`: si el backend cambiara el
  // reparto, este test avisa antes de que se note en la interfaz.
  expect(playas).toHaveLength(46);
  expect(conId).toHaveLength(10);
  expect(soloConPuestos).toHaveLength(32);
  expect(conId.length + soloConPuestos.length).toBe(42);
});

it('con el backend caído, La Concha sigue mostrando el badge', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  const { container } = renderWithProviders(<PlayasList />, { route: '/playas' });
  // 46 playas: se está pintando el JSON local, sin `idCruzRoja` para esta playa.
  await screen.findByText('46 playas');

  // Esta es la aserción que fallaba antes del arreglo.
  expect(badgeDe(container, 'La Concha')).not.toBeNull();
});

it('las playas sin ninguna fuente de vigilancia no muestran badge', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  const { container } = renderWithProviders(<PlayasList />, { route: '/playas' });
  await screen.findByText('46 playas');

  // Cuatro playas reales no tienen ni id ni puestos.
  expect(badgeDe(container, 'La Arena')).toBeNull();
  expect(badgeDe(container, 'Ostende')).toBeNull();
});

// Va el último: es el único que responde bien y por tanto el único que llena la
// caché de módulo de `services/api.ts` (ver cabecera).
it('con datos del backend, La Concha muestra el badge', async () => {
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);

  const { container } = renderWithProviders(<PlayasList />, { route: '/playas' });
  await screen.findByText('7 playas');

  // El DTO trae idCruzRoja 373 y además los dos puestos.
  expect(badgeDe(container, 'La Concha')).not.toBeNull();
});
