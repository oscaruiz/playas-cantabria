import React, { useState } from 'react';
import {
  BeachDetail as BeachDetail,
  ForecastDayDTO,
  HalfDayDTO,
  ForecastDay,
} from '../../../../../../Dev/playas-cantabria/frontend/src/services/api';
import DaySelector from '../../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/DaySelector';
import ForecastHero from '../../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/ForecastHero';
import DailyStats from '../../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/DailyStats';
import { AttributionNote, EstimatedValues } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/SourceAndFreshness';
import DataInfo from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/DataInfo';
import { sameSource } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/attributions';

/**
 * UV level (translatable label) derived from the index, WHO scale. OpenWeather
 * only gives the number, so we synthesize the label so that `DailyStats`
 * shows "10 — Muy alto" as on beaches with an AEMET sheet. Keys aligned
 * with `MAPA_UV` from `i18n/apiText.ts`.
 */
function uvLevelFromIndex(index: number): string {
  // Rounded first: Open-Meteo reports decimals and 7.25 would fall in the next
  // band, so the same real UV read as "Muy alto" here and "alto" on a beach
  // with an AEMET sheet.
  const uv = Math.round(index);
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
function weatherDayToForecast(d: ForecastDay, date: string, isToday: boolean): ForecastDayDTO {
  const medium: HalfDayDTO = { cielo: d.summary, iconoCielo: null, viento: d.wind, oleaje: d.waves };
  return {
    fecha: date,
    manana: medium,
    tarde: medium,
    temperaturaMaxima: isToday ? null : d.temperature,
    sensacionTermica: d.sensation,
    temperaturaAgua: d.waterTemperature,
    indiceUV: d.uvIndex ?? null,
    nivelUV: d.uvIndex != null ? uvLevelFromIndex(d.uvIndex) : null,
    aviso: null,
  };
}

/**
 * Weather header for beaches WITHOUT an AEMET sheet (`prediccionCompleta`
 * null, e.g. synthetic code). Reuses the hero with the Today/Tomorrow selector
 * built from `clima`, omitting the "Previsión AEMET" breakdown and the tides, which
 * this source does not provide.
 */
const WeatherHero: React.FC<{
  weather: NonNullable<BeachDetail['clima']>;
  currentTemperature?: number | null;
  currentConditions?: BeachDetail['tiempoActual'];
}> = ({ weather, currentTemperature, currentConditions }) => {
  const [chosenDay, setChosenDay] = useState(0);

  const today = new Date();
  const isoWithOffset = (days: number): string => {
    const d = new Date(today);
    d.setDate(today.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const days = [
    { clima: weather.hoy, fecha: isoWithOffset(0), esHoy: true },
    ...(weather.manana ? [{ clima: weather.manana, fecha: isoWithOffset(1), esHoy: false }] : []),
  ];
  const sel = Math.min(chosenDay, days.length - 1);
  const current = days[sel];
  const day = weatherDayToForecast(current.clima, current.fecha, current.esHoy);

  return (
    <>
      {days.length > 1 && (
        <DaySelector dates={days.map((d) => d.fecha)} selectedDay={sel} onSelect={setChosenDay} />
      )}
      <div className="detail-card forecast-panel">
        <ForecastHero
          day={day}
          currentWeather={current.esHoy ? currentTemperature : undefined}
          currentConditions={current.esHoy ? currentConditions : undefined}
        />
        <DailyStats day={day} embedded />
        {/* Ésta es la ficha SIN hoja de AEMET: la que más valores rellena el
            backend por su cuenta, y donde más falta hace poder mirar de dónde
            sale cada cosa. Todo bajo la misma ⓘ que el resto de bloques. */}
        <DataInfo label="info.fuente" aria="info.aria.prevision">
          <AttributionNote source={weather.fuente} />
          {/* El observador solo se acredita aparte cuando NO es el mismo que
              firma la previsión: repetirlo sería decir dos veces lo mismo. */}
          {current.esHoy && !sameSource(weather.fuente, currentConditions?.fuente) && (
            <AttributionNote source={currentConditions?.fuente} />
          )}
          <EstimatedValues fields={current.clima.estimados} />
        </DataInfo>
      </div>
    </>
  );
};

export default WeatherHero;
