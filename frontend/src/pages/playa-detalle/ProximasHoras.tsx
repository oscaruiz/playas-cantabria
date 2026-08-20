import React from 'react';
import { IonIcon } from '@ionic/react';
import { sunnyOutline, partlySunnyOutline, cloudyOutline } from 'ionicons/icons';
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
  if (!hayHoras && !ventana) return null;

  return (
    <section className="proximas-horas-section">
      <h3 className="section-kicker">{t('detalle.pronostico.titulo')}</h3>
      {hayHoras && (
      <ul className="pd-horas">
        {(horas as PrevisionHora[]).map((h) => (
          /* Una frase por hora para quien no ve la tira: la nubosidad solo la
             cuenta el icono, y el icono es decorativo. */
          <li
            className="pd-hora"
            key={h.horaIso}
            aria-label={t('detalle.pronostico.ariaHora', {
              hora: horaLocalMadrid(h.horaIso) ?? '--:--',
              nubes: h.nubesPct ?? '--',
              temp: h.temperaturaC != null ? Math.round(h.temperaturaC) : '--',
              viento: h.vientoMs != null ? Math.round(h.vientoMs) : '--',
            })}
          >
            <span className="pd-hora-reloj" aria-hidden="true">
              {horaLocalMadrid(h.horaIso) ?? '--:--'}
            </span>
            <IonIcon className="pd-hora-icono" icon={iconoDeNubes(h.nubesPct)} aria-hidden="true" />
            <span className="pd-hora-temp" aria-hidden="true">
              {h.temperaturaC != null ? `${Math.round(h.temperaturaC)}°` : '--'}
            </span>
            <span className="pd-hora-viento" aria-hidden="true">
              {h.vientoMs != null ? `${Math.round(h.vientoMs)} m/s` : '--'}
            </span>
          </li>
        ))}
      </ul>
      )}
      <MejorMomento ventana={ventana} />
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
