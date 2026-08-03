import React from 'react';
import { PlayaDetalle as PlayaDetalleData } from '../../services/api';
import {
  flagColorClass,
  estadoBandera,
  ultimaBanderaRegistrada,
  operadorVigilancia,
} from '../../utils/beachHelpers';
import { fechaMadrid, horaLocalMadrid } from '../../shared/format/tiempo';
import { capitalizar } from '../../shared/format/texto';
import { FreshnessLabel } from '../../features/provenance/SourceAndFreshness';
import InfoDatos from '../../features/provenance/InfoDatos';
import { normalizarInstante } from '../../features/provenance/procedencia';
import { useIdioma, Idioma, TraducirFn } from '../../shared/i18n/IdiomaContext';
import { traducirTextoApi, claveEstadoBandera, traducirOperador } from '../../shared/i18n/apiText';
import { nombreDia, formatearFechaCorta } from '../../shared/i18n/fechas';

/** "Registered today / yesterday / on <date> at HH:MM" — moment in Madrid time. */
function textoRegistrada(iso: string, t: TraducirFn, idioma: Idioma): string {
  const hora = horaLocalMadrid(iso);
  if (!hora) return '';
  const ahora = new Date();
  const dia = fechaMadrid(new Date(iso));
  if (dia === fechaMadrid(ahora)) return t('detalle.registradaHoy', { hora });
  if (dia === fechaMadrid(new Date(ahora.getTime() - 86400000))) {
    return t('detalle.registradaAyer', { hora });
  }
  const [anio, mes, diaMes] = dia.split('-').map(Number);
  const nombre = capitalizar(nombreDia(new Date(Date.UTC(anio, mes - 1, diaMes)).getUTCDay(), idioma));
  return t('detalle.registradaFecha', {
    fecha: formatearFechaCorta(nombre, diaMes, mes - 1, idioma),
    hora,
  });
}

const FlagBanner: React.FC<{
  cruzRoja?: PlayaDetalleData['cruzRoja'];
  /** Beach whose operator names the banner; absent = the legacy Cruz Roja one. */
  playa?: Pick<PlayaDetalleData, 'fuenteBanderas'>;
}> = ({ cruzRoja, playa }) => {
  const { t, idioma } = useIdioma();
  const operador = operadorVigilancia(playa);
  const estado = estadoBandera(cruzRoja);
  // 'sinDatos' (within hours but no capture yet, transient): we show no banner.
  // No operator: there is no flag to report here at all.
  if (estado === 'sinDatos' || !operador) {
    return null;
  }

  // Outside of hours there is no flag in force, but the last registered one is shown
  // (dimmed color + when it was flying) as long as it remains informative.
  const ultima = estado === 'fueraDeHorario' ? ultimaBanderaRegistrada(cruzRoja) : null;

  // Full color is only for the flag in force ('color'); with no flag to
  // show, neutral pennant even if a color is stored.
  const colorClass = estado === 'color'
    ? flagColorClass(cruzRoja!.bandera)
    : ultima
      ? `${flagColorClass(ultima.bandera)} atenuada`
      : 'unknown';
  const capturaBanderaMs =
    estado === 'color' ? normalizarInstante(cruzRoja?.ultimaActualizacion) : null;

  return (
    <div className="flag-banner">
      <span className={`flag-pennant ${colorClass}`} role="img" aria-label={t('detalle.banderaAria')} />
      <div className="flag-info">
        <div className="flag-label">
          {t('detalle.estadoBano', { operador: traducirOperador(operador, idioma) })}
        </div>
        <div className="flag-value">
          {ultima
            ? t('bandera.ultimaRegistrada', {
                bandera: capitalizar(traducirTextoApi(ultima.bandera, idioma)),
              })
            : t(claveEstadoBandera(estado, cruzRoja!.bandera))}
        </div>
        {cruzRoja!.horario && (
          <div className="flag-horario">{t('detalle.vigilancia', { horario: cruzRoja!.horario })}</div>
        )}
        {ultima && <div className="flag-horario">{textoRegistrada(ultima.registradaIso, t, idioma)}</div>}
        {capturaBanderaMs != null && (
          <div className="flag-horario">
            <FreshnessLabel instante={capturaBanderaMs} capitalizado />
          </div>
        )}
      </div>
      {/* Solo el aviso, y por eso se llama «Aviso». El crédito del operador
          vive en la tarjeta de vigilancia, que se pinta siempre que hay
          operador —también cuando este banner no— así que allí cubre todos
          los casos y aquí solo sería un duplicado. */}
      <InfoDatos
        etiqueta="info.aviso"
        aria="info.aria.bandera"
        className="info-datos--hero"
      >
        <p>{t('aviso.banderas')}</p>
      </InfoDatos>
    </div>
  );
};

export default FlagBanner;
