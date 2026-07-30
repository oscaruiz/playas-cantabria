import React, { useState } from 'react';
import {
  PlayaDetalle as PlayaDetalleData,
  DiaPrediccionDTO,
  HalfDayDTO,
  PrediccionDia,
} from '../../services/api';
import DaySelector from './DaySelector';
import ForecastHero from './ForecastHero';
import DailyStats from './DailyStats';

/**
 * UV level (translatable label) derived from the index, WHO scale. OpenWeather
 * only gives the number, so we synthesize the label so that `DailyStats`
 * shows "10 — Muy alto" as on beaches with an AEMET sheet. Keys aligned
 * with `MAPA_UV` from `i18n/apiText.ts`.
 */
function nivelUVDesdeIndice(uv: number): string {
  if (uv <= 2) return 'Bajo';
  if (uv <= 5) return 'Medio';
  if (uv <= 7) return 'Alto';
  if (uv <= 10) return 'Muy alto';
  return 'Extremo';
}

/**
 * Adapts a `clima` (OpenWeather) day to the shape consumed by `ForecastHero`.
 * Only the headline matters (sky/temp/water/wind/waves); there is no
 * morning/afternoon breakdown or warnings, so both half-days carry the same summary.
 * `esHoy`: with no daily maximum in OpenWeather, today's main temp is the
 * real observation (`temperaturaActual`), so we leave `temperaturaMaxima`
 * as null to avoid painting a duplicated "Max" line.
 */
function climaDiaAPrediccion(d: PrediccionDia, fecha: string, esHoy: boolean): DiaPrediccionDTO {
  const medio: HalfDayDTO = { cielo: d.summary, iconoCielo: null, viento: d.wind, oleaje: d.waves };
  return {
    fecha,
    manana: medio,
    tarde: medio,
    temperaturaMaxima: esHoy ? null : d.temperature,
    sensacionTermica: d.sensation,
    temperaturaAgua: d.waterTemperature,
    indiceUV: d.uvIndex ?? null,
    nivelUV: d.uvIndex != null ? nivelUVDesdeIndice(d.uvIndex) : null,
    aviso: null,
  };
}

/**
 * Weather header for beaches WITHOUT an AEMET sheet (`prediccionCompleta`
 * null, e.g. synthetic code). Reuses the hero with the Today/Tomorrow selector
 * built from `clima`, omitting the "Previsión AEMET" breakdown and the tides, which
 * this source does not provide.
 */
const ClimaHero: React.FC<{
  clima: NonNullable<PlayaDetalleData['clima']>;
  temperaturaActual?: number | null;
  tiempoActual?: PlayaDetalleData['tiempoActual'];
}> = ({ clima, temperaturaActual, tiempoActual }) => {
  const [diaSel, setDiaSel] = useState(0);

  const hoy = new Date();
  const isoConOffset = (dias: number): string => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const dias = [
    { clima: clima.hoy, fecha: isoConOffset(0), esHoy: true },
    ...(clima.manana ? [{ clima: clima.manana, fecha: isoConOffset(1), esHoy: false }] : []),
  ];
  const sel = Math.min(diaSel, dias.length - 1);
  const actual = dias[sel];
  const dia = climaDiaAPrediccion(actual.clima, actual.fecha, actual.esHoy);

  return (
    <>
      {dias.length > 1 && (
        <DaySelector fechas={dias.map((d) => d.fecha)} selectedDay={sel} onSelect={setDiaSel} />
      )}
      <div className="detail-card prevision-panel">
        <ForecastHero
          dia={dia}
          climaActual={actual.esHoy ? temperaturaActual : undefined}
          tiempoActual={actual.esHoy ? tiempoActual : undefined}
        />
        <DailyStats dia={dia} embedded />
      </div>
    </>
  );
};

export default ClimaHero;
