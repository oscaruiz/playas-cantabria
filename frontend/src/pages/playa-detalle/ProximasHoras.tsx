import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  sunnyOutline,
  partlySunnyOutline,
  cloudyOutline,
  rainyOutline,
  chevronBackOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { PrevisionHora, VentanaDia } from '../../services/api';
import MejorMomento from '../../components/MejorMomento';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import { horaLocalMadrid } from '../../shared/format/tiempo';
import { procedenciaPrevisionHoras } from '../../features/provenance/procedencia';
import { atribucionDeFuente } from '../../features/provenance/atribuciones';
import { AttributionNote, SourceAndFreshness } from '../../features/provenance/SourceAndFreshness';
import InfoDatos from '../../features/provenance/InfoDatos';

/** Cloud cover → the same three states the score uses (clear / scattered / broken). */
function iconoDeNubes(pct: number | null): string {
  if (pct == null) return partlySunnyOutline;
  if (pct <= 25) return sunnyOutline;
  if (pct <= 50) return partlySunnyOutline;
  return cloudyOutline;
}

/**
 * The next few hours, hour by hour. It lives next to the tides and not inside
 * the score's disclosure because it answers a question of its own — "if I go
 * later, what do I find?" — which nobody thinks to look for under "how the
 * score is calculated".
 *
 * The day window ("mejor momento") shares this card: it is the conclusion the
 * hours above it back up, drawn under them and above the source credit.
 *
 * Renders nothing when there is neither an hourly strip nor a window: outside
 * the beach window, or with both hourly sources down.
 */
const ProximasHoras: React.FC<{
  horas?: PrevisionHora[] | null;
  fuente?: string | null;
  ventana?: VentanaDia | null;
}> = ({ horas, fuente, ventana }) => {
  const { t } = useIdioma();
  const hayHoras = (horas?.length ?? 0) > 0;

  // Scroll affordance: the strip overflows on phones, and a clean cut at the
  // card edge reads as "this is everything". Fixed-width hours make the last
  // visible one PEEK out half-cut, and an edge fade appears on whichever side
  // still hides content — the two standard signals for a horizontal rail.
  const scrollRef = useRef<HTMLUListElement | null>(null);
  const [masDespues, setMasDespues] = useState(false);
  const [masAntes, setMasAntes] = useState(false);

  const medirScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setMasAntes(el.scrollLeft > 1);
    setMasDespues(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    medirScroll();
    // The container resizes with the viewport (rotation, window resize).
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(medirScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [medirScroll, horas]);

  // The arrows both SIGNAL the rail moves and move it: most of a screenful
  // per press, with an overlap so no hour is ever skipped past unseen.
  const desplazar = (direccion: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const reducida =
      typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direccion * el.clientWidth * 0.8,
      behavior: reducida ? 'auto' : 'smooth',
    });
  };

  if (!hayHoras && !ventana) return null;

  // Does this hour's SLOT overlap the recommended window? By interval, not by
  // start: the in-progress slot can start before the (clamped) window start
  // and still be the hour the window is recommending right now. The slot end
  // is the next slot's start; the last one borrows the previous step.
  const lista = horas ?? [];
  const enVentana = (i: number): boolean => {
    if (!ventana) return false;
    const inicioMs = Date.parse(ventana.inicio);
    const finMs = Date.parse(ventana.fin);
    const slotInicio = Date.parse(lista[i].horaIso);
    if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs) || !Number.isFinite(slotInicio)) {
      return false;
    }
    const siguiente = i + 1 < lista.length ? Date.parse(lista[i + 1].horaIso) : NaN;
    const anterior = i > 0 ? Date.parse(lista[i - 1].horaIso) : NaN;
    const paso = Number.isFinite(siguiente)
      ? siguiente - slotInicio
      : Number.isFinite(anterior)
        ? slotInicio - anterior
        : 3_600_000;
    return slotInicio < finMs && slotInicio + paso > inicioMs;
  };

  return (
    <section className="proximas-horas-section">
      <h3 className="section-kicker">{t('detalle.pronostico.tituloRestoDia')}</h3>
      {hayHoras && (
      <div
        className={`pd-horas-marco${masAntes ? ' pd-horas-marco--antes' : ''}${masDespues ? ' pd-horas-marco--despues' : ''}`}
      >
      <ul
        className="pd-horas"
        ref={scrollRef}
        onScroll={medirScroll}
        // A scrollable region must be reachable and named for the keyboard:
        // without tabindex its content is unreachable scrolling by keys.
        role="region"
        aria-label={t('detalle.pronostico.tituloRestoDia')}
        tabIndex={0}
      >
        {lista.map((h, i) => {
          const mojada = (h.precipitacionMm ?? 0) > 0;
          return (
          /* Una frase por hora para quien no ve la tira: la nubosidad solo la
             cuenta el icono, y el icono es decorativo. */
          <li
            className={`pd-hora${enVentana(i) ? ' pd-hora--mejor' : ''}`}
            key={h.horaIso}
            aria-label={t(mojada ? 'detalle.pronostico.ariaHoraLluvia' : 'detalle.pronostico.ariaHora', {
              hora: horaLocalMadrid(h.horaIso) ?? '--:--',
              nubes: h.nubesPct ?? '--',
              temp: h.temperaturaC != null ? Math.round(h.temperaturaC) : '--',
              viento: h.vientoMs != null ? Math.round(h.vientoMs) : '--',
            })}
          >
            <span className="pd-hora-reloj" aria-hidden="true">
              {horaLocalMadrid(h.horaIso) ?? '--:--'}
            </span>
            {/* Rain replaces the cloud icon outright: a wet hour is what the
                window dodges, and a cloud there would hide the one fact that
                explains the recommendation. */}
            <IonIcon
              className={`pd-hora-icono${mojada ? ' pd-hora-icono--lluvia' : ''}`}
              icon={mojada ? rainyOutline : iconoDeNubes(h.nubesPct)}
              aria-hidden="true"
            />
            <span className="pd-hora-temp" aria-hidden="true">
              {h.temperaturaC != null ? `${Math.round(h.temperaturaC)}°` : '--'}
            </span>
            <span className="pd-hora-viento" aria-hidden="true">
              {h.vientoMs != null ? `${Math.round(h.vientoMs)} m/s` : '--'}
            </span>
          </li>
          );
        })}
      </ul>
      {masAntes && (
        <button
          type="button"
          className="pd-horas-flecha pd-horas-flecha--antes"
          aria-label={t('detalle.pronostico.horasAnteriores')}
          onClick={() => desplazar(-1)}
        >
          <IonIcon icon={chevronBackOutline} aria-hidden="true" />
        </button>
      )}
      {masDespues && (
        <button
          type="button"
          className="pd-horas-flecha pd-horas-flecha--despues"
          aria-label={t('detalle.pronostico.horasSiguientes')}
          onClick={() => desplazar(1)}
        >
          <IonIcon icon={chevronForwardOutline} aria-hidden="true" />
        </button>
      )}
      </div>
      )}
      <MejorMomento ventana={ventana} detallada />
      {/* Quién lo pronostica, y qué hacemos con ello: estas mismas horas
          alimentan la puntuación, así que la licencia obliga a decir que los
          datos van adaptados. Esa nota ya acredita y enlaza la fuente, de modo
          que el crédito genérico solo sale cuando no hay nota — repetirlo
          sería decir dos veces lo mismo. The API sends no emission time for
          the outlook, so none is shown either way. */}
      {hayHoras && (
        <InfoDatos etiqueta="info.fuente" aria="info.aria.horas" className="proximas-horas-fuente">
          {atribucionDeFuente(fuente)?.nota ? (
            <AttributionNote fuente={fuente} />
          ) : (
            <SourceAndFreshness procedencia={procedenciaPrevisionHoras(fuente)} />
          )}
        </InfoDatos>
      )}
    </section>
  );
};

export default ProximasHoras;
