import React from 'react';
import { PlayaDetalle as PlayaDetalleData } from '../../services/api';
import {
  flagColorClass,
  estadoBandera,
  ultimaBanderaRegistrada,
  fechaMadrid,
  capitalizar,
  horaLocalMadrid,
  formatearHaceTiempo,
} from '../../utils/beachHelpers';
import { useIdioma, Idioma, TraducirFn } from '../../i18n/IdiomaContext';
import { traducirTextoApi, claveEstadoBandera } from '../../i18n/apiText';
import { nombreDia, formatearFechaCorta } from '../../i18n/fechas';

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

const FlagBanner: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  const { t, idioma } = useIdioma();
  const estado = estadoBandera(cruzRoja);
  // 'sinDatos' (within hours but no capture yet, transient): we show no banner.
  if (estado === 'sinDatos') {
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
  const actualizado =
    estado === 'color' && cruzRoja!.ultimaActualizacion
      ? formatearHaceTiempo(cruzRoja!.ultimaActualizacion, t)
      : '';

  return (
    <div className="flag-banner">
      <span className={`flag-pennant ${colorClass}`} role="img" aria-label={t('detalle.banderaAria')} />
      <div className="flag-info">
        <div className="flag-label">{t('detalle.estadoBano')}</div>
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
        {actualizado && <div className="flag-horario">{capitalizar(actualizado)}</div>}
      </div>
    </div>
  );
};

export default FlagBanner;
