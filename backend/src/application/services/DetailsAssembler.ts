import { GetBeachDetails, type BeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { DetailsMapper } from '../mappers/DetailsMapper';
import type {
  DetailsDTO,
  ClimaDTO,
  ClimaDiaDTO,
  CampoEstimado,
  LluviaDTO,
  PrediccionCompletaDTO,
} from '../../contract/api';
import { BeachRepository } from '../../domain/ports/BeachRepository';
import { findTideReference } from '../../domain/services/tideReference';
import type { ForecastWeatherSource } from '../../domain/ports/ForecastWeatherSource';
import type { BeachFullForecastSource } from '../../domain/ports/BeachFullForecastSource';
import type { BeachForecastProvider } from '../../domain/ports/BeachForecastProvider';
import type { Cache } from '../../domain/ports/Cache';
import { buildRainForecastSignal, textosRestantesHoy } from '../../domain/use-cases/RainForecast';
import {
  buildDayWindow,
  recortarAFranjaRestante,
  type DayWindowSignal,
} from '../../domain/use-cases/BeachWindowScorer';
import { mapVentanaDia } from '../mappers/FeaturedBeachMapper';
import { OPEN_METEO_NOMBRE, type HourlyOutlookSlot, type RainNowcast } from '../../domain/entities/RainNowcast';
import type { BeachFullForecast, BeachShortForecast } from '../../domain/entities/BeachForecast';

/** Cache key and TTLs of the assembled detail, decided by the wiring. */
export interface DetailsCacheSettings {
  cacheKey(beachId: string): string;
  freshTtlSeconds(): number;
  staleTtlSeconds(): number;
}

/**
 * Details assembler (serves /:id/details) — fallback chain:
 *   Layer 1: AemetBeachWebScraper    (3 days, morning/afternoon, tides, warnings — no API key)
 *   Layer 2: AemetBeachForecastProvider (2 days, OpenData API — requires API key)
 *   Layer 3: OpenWeatherWeatherProvider (temp, wind, desc)
 *   Layer 4: GetBeachDetails use-case  (hedged AEMET API + OpenWeather + Cruz Roja flag)
 */
export class DetailsAssembler {
  constructor(
    private readonly getDetails: GetBeachDetails,
    private readonly aemetScraper: BeachFullForecastSource,
    private readonly aemetPlayas: BeachForecastProvider,
    private readonly openWeather: ForecastWeatherSource,
    /** Optional pair: without both, every request assembles fresh. */
    private readonly cache?: Cache,
    private readonly cacheSettings?: DetailsCacheSettings,
    /** Optional: without it a beach with no AEMET sheet gets no reference tide. */
    private readonly beachRepo?: BeachRepository,
  ) {}


  /**
   * The hourly strip, with a second source standing behind the first.
   *
   * Open-Meteo carries these slots inside the nowcast request, so while it
   * answers this costs nothing extra. When it does NOT — it is a free service
   * and it rate-limits, which is precisely what left every beach without the
   * block in production — OpenWeather's 5d/3h forecast is already fetched and
   * cached for the half-days, so the fallback adds no request either.
   *
   * Coarser, and it says so: three-hour steps mean fewer points inside the
   * same window. The name of whoever answered travels with the data, so the
   * client credits the right one instead of putting one provider's numbers
   * under another's name.
   */
  private async resolverPrevisionHoras(
    lat: number,
    lon: number,
    delNowcast: readonly HourlyOutlookSlot[] | null | undefined,
  ): Promise<{ horas: HourlyOutlookSlot[]; fuente: string } | null> {
    const ahora = new Date();
    // The whole remaining beach window, not the outlook's 4h ceiling: the
    // strip is the evidence behind "mejor momento", which judges every
    // remaining hour — a 4h strip could not show WHY the window ends when it
    // does. Same trim the verdict itself uses, so they can never disagree.
    const preferidas = recortarAFranjaRestante(delNowcast ?? [], ahora);
    if (preferidas.length > 0) return { horas: preferidas, fuente: OPEN_METEO_NOMBRE };

    try {
      const horas = recortarAFranjaRestante(await this.openWeather.getOutlookSlots(lat, lon), ahora);
      return horas.length > 0 ? { horas, fuente: 'OpenWeather' } : null;
    } catch {
      // Both sources silent, or simply out of the beach window: an empty
      // strip is the honest answer. Nothing here is ever invented.
      return null;
    }
  }

  /**
   * The day window ("mejor momento"): the ranking's own when the detail is
   * built from the ranking's entry, and otherwise the SAME rule the ranking
   * applies (`assessBeach`): Open-Meteo's slots only. The detail used to fall
   * back to OpenWeather's slots, so with Open-Meteo down the card said nothing
   * and the detail one tap away said "best from 12:00" (10-oct-2026).
   */
  private resolverVentanaDia(
    details: BeachDetails,
  ): { ventana: DayWindowSignal; fuente: string } | null {
    const ventana = details.ventanaDia !== undefined
      ? details.ventanaDia
      : buildDayWindow(details.rain?.outlook, new Date(), details.rain);
    return ventana ? { ventana, fuente: OPEN_METEO_NOMBRE } : null;
  }

  // -----------------------------------------------------------------------
  // Icon mapping
  // -----------------------------------------------------------------------

  private legacyIconFromSummary(summary: string | null): number | null {
    if (!summary) return null;
    const s = summary.toLowerCase();
    if (/(despejado|soleado)/.test(s)) return 100;
    if (/(poco\s*nuboso|intervalos|parcial|nubes\s*dispersas|claro)/.test(s)) return 110;
    if (/(nuboso|nublado|muy nuboso|cubierto|nubes)/.test(s)) return 120;
    if (/(llovizna|chubasc|lluvia)/.test(s)) return 200;
    if (/(tormenta|electrica|rayos)/.test(s)) return 210;
    if (/(nieve|nevada|aguanieve)/.test(s)) return 300;
    if (/(niebla|bruma|neblina)/.test(s)) return 400;
    return null;
  }

  // -----------------------------------------------------------------------
  // Helpers shared across fallback layers
  // -----------------------------------------------------------------------

  /**
   * Adds a field to a day's `estimados` without duplicating it. Every place
   * that DERIVES a value has to go through here, or the client will show a
   * guess with the same face as a measurement.
   */
  private marcarEstimado(dia: ClimaDiaDTO, ...campos: CampoEstimado[]): ClimaDiaDTO {
    const ya = new Set(dia.estimados ?? []);
    campos.forEach((c) => ya.add(c));
    return { ...dia, estimados: [...ya] };
  }

  private wavesFromWind(windMs: number | null): string | null {
    if (windMs == null) return null;
    const kmh = windMs * 3.6;
    if (kmh > 20) return 'agitado';
    if (kmh > 10) return 'moderado';
    return 'tranquilo';
  }

  private sensationFromTemp(t: number | null): string | null {
    if (t == null) return null;
    if (t < 10) return 'frío';
    if (t < 18) return 'templado';
    if (t < 26) return 'agradable';
    if (t < 32) return 'calor moderado';
    return 'calor intenso';
  }

  private guessWind(ms: number | null): string | null {
    if (ms == null) return null;
    if (ms < 3) return 'calma';
    if (ms < 6) return 'flojo';
    if (ms < 10) return 'moderado';
    if (ms < 15) return 'fresco';
    return 'fuerte';
  }

  /**
   * Fills in the fields of a half-day (morning/afternoon) that AEMET left empty,
   * using the OpenWeather forecast. Never overwrites an existing AEMET value. Waves
   * are estimated from wind (OpenWeather has no waves), consistent with the summary card.
   */
  private rellenarMedioDia(
    half: { cielo: string | null; iconoCielo: number | null; viento: string | null; oleaje: string | null },
    ow?: { descripcion: string | null; iconOw: string | null; vientoMs: number | null },
  ): { cielo: string | null; iconoCielo: number | null; viento: string | null; oleaje: string | null } {
    if (!ow) return half;
    const cielo =
      half.cielo ??
      (ow.descripcion ? ow.descripcion.charAt(0).toUpperCase() + ow.descripcion.slice(1) : null);
    return {
      cielo,
      iconoCielo: half.iconoCielo ?? this.legacyIconFromSummary(cielo),
      viento: half.viento ?? this.guessWind(ow.vientoMs),
      oleaje: half.oleaje ?? this.wavesFromWind(ow.vientoMs),
    };
  }

  // -----------------------------------------------------------------------
  // Build clima from scraper forecast (Layer 1)
  // -----------------------------------------------------------------------

  private buildClimaFromForecast(forecast: BeachFullForecast): ClimaDTO {
    const mapDay = (dayIdx: number): ClimaDiaDTO => {
      const day = forecast.days[dayIdx];
      if (!day) {
        return {
          summary: null, temperature: null, waterTemperature: null,
          sensation: null, wind: null, waves: null, uvIndex: null, icon: null,
        };
      }
      return {
        summary: day.morning.skyDescription ?? day.afternoon.skyDescription ?? null,
        temperature: day.maxTemperatureC,
        waterTemperature: day.waterTemperatureC,
        sensation: day.thermalSensation,
        wind: day.morning.wind ?? day.afternoon.wind ?? null,
        waves: day.morning.waves ?? day.afternoon.waves ?? null,
        uvIndex: day.uvIndexMax,
        icon: this.legacyIconFromSummary(day.morning.skyDescription),
      };
    };

    return {
      fuente: 'AEMET',
      ultimaActualizacion: forecast.elaboration ?? new Date().toISOString(),
      hoy: mapDay(0),
      manana: forecast.days.length > 1 ? mapDay(1) : null,
    };
  }

  // -----------------------------------------------------------------------
  // Build clima from AEMET Playas API (Layer 2)
  // -----------------------------------------------------------------------

  private buildClimaFromAemetPlayas(
    playa: BeachShortForecast,
    base: ClimaDTO | null,
  ): ClimaDTO {
    const hoy = playa.today;
    const mananaPlayas = playa.tomorrow;

    const hoyDto: ClimaDiaDTO = {
      summary: hoy.summary ?? base?.hoy.summary ?? null,
      temperature: hoy.temperature ?? base?.hoy.temperature ?? null,
      waterTemperature: hoy.waterTemperature ?? base?.hoy.waterTemperature ?? null,
      sensation: hoy.sensation ?? base?.hoy.sensation ?? null,
      wind: hoy.wind ?? base?.hoy.wind ?? null,
      waves: hoy.waves ?? base?.hoy.waves ?? null,
      uvIndex: hoy.uvIndex ?? base?.hoy.uvIndex ?? null,
      icon: this.legacyIconFromSummary(hoy.summary) ?? base?.hoy.icon ?? null,
    };

    let mananaDto: ClimaDiaDTO | null = null;
    if (mananaPlayas) {
      mananaDto = {
        summary: mananaPlayas.summary ?? base?.manana?.summary ?? null,
        temperature: mananaPlayas.temperature ?? base?.manana?.temperature ?? null,
        waterTemperature: mananaPlayas.waterTemperature ?? base?.manana?.waterTemperature ?? null,
        sensation: mananaPlayas.sensation ?? base?.manana?.sensation ?? null,
        wind: mananaPlayas.wind ?? base?.manana?.wind ?? null,
        waves: mananaPlayas.waves ?? base?.manana?.waves ?? null,
        uvIndex: mananaPlayas.uvIndex ?? base?.manana?.uvIndex ?? null,
        icon: this.legacyIconFromSummary(mananaPlayas.summary) ?? base?.manana?.icon ?? null,
      };
    }

    return base
      ? { ...base, hoy: { ...base.hoy, ...hoyDto }, manana: mananaDto ?? base.manana }
      : { fuente: 'AEMET', ultimaActualizacion: playa.lastUpdatedIso, hoy: hoyDto, manana: mananaDto };
  }

  // -----------------------------------------------------------------------
  // Map forecast → prediccionCompleta DTO
  // -----------------------------------------------------------------------

  private mapForecastToDTO(forecast: BeachFullForecast): PrediccionCompletaDTO {
    const mapHalf = (h: BeachFullForecast['days'][number]['morning']) => ({
      cielo: h.skyDescription,
      iconoCielo: h.skyIconCode,
      viento: h.wind,
      oleaje: h.waves,
    });

    return {
      fuente: forecast.source,
      elaboracion: forecast.elaboration,
      zonaAvisos: forecast.warningZone,
      dias: forecast.days.map((d) => ({
        fecha: d.date,
        manana: mapHalf(d.morning),
        tarde: mapHalf(d.afternoon),
        temperaturaMaxima: d.maxTemperatureC,
        sensacionTermica: d.thermalSensation,
        temperaturaAgua: d.waterTemperatureC,
        indiceUV: d.uvIndexMax,
        nivelUV: d.uvLevel,
        aviso: d.warning
          ? { nivel: d.warning.level, descripcion: d.warning.description }
          : null,
      })),
      mareas: forecast.tides.map((t) => ({
        pleamar: t.highTide,
        bajamar: t.lowTide,
      })),
      fuenteMareas: forecast.tidesSource,
    };
  }

  // -----------------------------------------------------------------------
  // Main assemble
  // -----------------------------------------------------------------------

  async assemble(beachId: string): Promise<DetailsDTO> {
    if (!this.cache || !this.cacheSettings) return this.assembleFresh(beachId);

    return this.cache.getOrSetStale(
      this.cacheSettings.cacheKey(beachId),
      this.cacheSettings.freshTtlSeconds(),
      this.cacheSettings.staleTtlSeconds(),
      () => this.assembleFresh(beachId),
    );
  }

  private async assembleFresh(beachId: string): Promise<DetailsDTO> {
    // Step 1: Base data from use-case: weather (sky already corrected), raw
    // flag and rain nowcast, from the same module the ranking uses.
    const details = await this.getDetails.execute(beachId);
    const base = DetailsMapper.toDTO(details);
    const forecastPromise = details.beach.sinAemet
      ? Promise.resolve(null)
      : this.aemetScraper
          .getBeachForecast(details.beach.aemetCode)
          .catch(() => null);
    const tomorrowPromise = this.openWeather
      .getTomorrowByCoords(details.beach.latitude, details.beach.longitude)
      .catch(() => null);

    // Step 1.5: Real-time "now" for TODAY, from whichever source the chain in
    // `BeachConditions` settled on. AEMET's station used to be left out
    // because its sky was made up; it now carries the day's forecast sky
    // labelled `previsto`, or none, and the temperature is a real reading.
    base.tiempoActual = details.weather ? DetailsMapper.mapTiempoActual(details.weather) : null;

    // Step 1.6: Aggregated rain signal (multi-source: OpenWeather + AEMET
    // rain gauge + Open-Meteo). Single-provider models miss hyperlocal
    // coastal drizzle; it is cross-checked with more sources. Additive field.
    const rainSignal: RainNowcast | null = details.rain;
    try {
      if (rainSignal && base.tiempoActual) {
        // The slots are trimmed with the very function the score uses, so the
        // strip shown and the adjustment applied cannot describe different
        // hours. Empty only when BOTH sources are silent or we are out of the
        // beach window.
        const prevision = await this.resolverPrevisionHoras(
          details.beach.latitude,
          details.beach.longitude,
          rainSignal.outlook,
        );
        base.tiempoActual = {
          ...base.tiempoActual,
          lluvia: DetailsMapper.mapLluvia(rainSignal),
          previsionHoras: prevision ? DetailsMapper.mapPrevisionHoras(prevision.horas) : null,
          previsionHorasFuente: prevision?.fuente ?? null,
        };
      }
      // WHEN to go today. Outside the `rainSignal` guard on purpose: with the
      // nowcast down the window still has OpenWeather's slots to stand on.
      if (base.tiempoActual) {
        const ventana = this.resolverVentanaDia(details);
        base.tiempoActual = {
          ...base.tiempoActual,
          ventanaDia: ventana ? mapVentanaDia(ventana.ventana) : null,
          ventanaDiaFuente: ventana?.fuente ?? null,
        };
      }
    } catch {
      // no structured rain signal; the rest of the endpoint is unaffected
    }

    // Step 2: Try scraper (Layer 1 — richest source).
    // Beaches without an AEMET page (synthetic code) must not trigger AEMET
    // calls that would always 404: the scraper and the beaches API are skipped.
    const forecast: BeachFullForecast | null = await forecastPromise;

    // Step 2.5: FORECAST rain — Open-Meteo numeric forecast (next 6h, comes
    // in the Step 1.6 nowcast) ∪ AEMET text for the remaining part of today
    // (needs the Step 2 forecast). Additive field inside `lluvia`.
    try {
      const señal = buildRainForecastSignal(
        rainSignal,
        textosRestantesHoy(forecast?.days[0] ?? null),
      );
      if (señal?.expected && base.tiempoActual) {
        // If the nowcast went down but the AEMET text warns, synthesize the
        // `lluvia` container so the forecast can be attached.
        const lluviaBase: LluviaDTO = base.tiempoActual.lluvia ?? {
          estado: 'desconocido',
          mm: null,
          ultimaHora: false,
          fuentes: [],
          timestamp: new Date().toISOString(),
        };
        base.tiempoActual = {
          ...base.tiempoActual,
          lluvia: { ...lluviaBase, prevista: DetailsMapper.mapLluviaPrevista(señal) },
        };
      }
    } catch {
      // additive: it never breaks the endpoint
    }

    // Step 3: Build clima (backward-compatible)
    if (forecast && forecast.days.length > 0) {
      // Layer 1: scraper succeeded
      base.clima = this.buildClimaFromForecast(forecast);
    } else {
      // Layer 2: AEMET Playas API (skipped for beaches without an AEMET page)
      try {
        if (details.beach.aemetCode && !details.beach.sinAemet) {
          const playa = await this.aemetPlayas.getByBeachCode(details.beach.aemetCode);
          base.clima = this.buildClimaFromAemetPlayas(playa, base.clima);
        }
      } catch {
        // Layer 3: base.clima already has OpenWeather/AEMET hedged data from use-case
      }
    }

    // Step 4: Enrich manana with OpenWeather forecast if still missing
    try {
      const owTomorrow = await tomorrowPromise;
      if (!owTomorrow) throw new Error('Tomorrow forecast unavailable');
      const mapIcon = (icon: string | null) => {
        if (!icon) return null;
        if (icon.startsWith('01')) return 100;
        if (icon.startsWith('02')) return 110;
        if (icon.startsWith('03') || icon.startsWith('04')) return 120;
        if (icon.startsWith('09') || icon.startsWith('10')) return 200;
        if (icon.startsWith('11')) return 210;
        if (icon.startsWith('13')) return 300;
        if (icon.startsWith('50')) return 400;
        return null;
      };

      const existing = base.clima?.manana ?? null;
      const owSummary = owTomorrow.description
        ? owTomorrow.description.charAt(0).toUpperCase() + owTomorrow.description.slice(1)
        : null;

      const chosenTemp = existing?.temperature ?? owTomorrow.temperatureC ?? null;

      // Whatever AEMET did not fill is DERIVED here from the temperature and
      // the wind; each fallback that actually fires has to say so.
      const derivados: CampoEstimado[] = [];
      if (!existing?.sensation && this.sensationFromTemp(chosenTemp)) derivados.push('sensacion');
      if (!existing?.wind && this.guessWind(owTomorrow.windSpeedMs)) derivados.push('viento');
      if (!existing?.waves && this.wavesFromWind(owTomorrow.windSpeedMs)) derivados.push('oleaje');

      const manana: ClimaDiaDTO = {
        summary: existing?.summary ?? owSummary ?? null,
        temperature: chosenTemp,
        waterTemperature: existing?.waterTemperature ?? null,
        sensation: existing?.sensation ?? this.sensationFromTemp(chosenTemp),
        wind: existing?.wind ?? this.guessWind(owTomorrow.windSpeedMs),
        waves: existing?.waves ?? this.wavesFromWind(owTomorrow.windSpeedMs),
        uvIndex: existing?.uvIndex ?? null,
        icon: existing?.icon ?? mapIcon(owTomorrow.icon) ?? null,
        ...(existing?.estimados ? { estimados: existing.estimados } : {}),
      };
      const mananaMarcada = derivados.length > 0 ? this.marcarEstimado(manana, ...derivados) : manana;

      base.clima = base.clima
        ? { ...base.clima, manana: mananaMarcada }
        : {
            fuente: 'OpenWeather',
            ultimaActualizacion: new Date(owTomorrow.timestamp).toISOString(),
            hoy: mananaMarcada,
            manana: mananaMarcada,
          };
    } catch {
      // forecast failed -> keep current value
    }

    // Step 5: UV. Priority: AEMET (already in clima) → Open-Meteo (comes for FREE
    // in the Step 1.6 nowcast, same request) → estimate from cloudiness. The old
    // OpenWeather One Call 2.5 request was removed: the endpoint is dead and only
    // burned quota to always end up down here anyway.
    if (base.clima) {
      let hoyUv: number | null = base.clima.hoy.uvIndex ?? null;
      let mananaUv: number | null = base.clima.manana ? base.clima.manana.uvIndex ?? null : null;

      const uvOpenMeteo = rainSignal?.uvIndexMax ?? null;
      if (uvOpenMeteo) {
        hoyUv = hoyUv ?? uvOpenMeteo.today ?? null;
        mananaUv = base.clima.manana ? (mananaUv ?? uvOpenMeteo.tomorrow ?? null) : null;
      }

      // Only the cloudiness branch ESTIMATES: AEMET's index is a forecast and
      // Open-Meteo's is a model's, so neither is marked.
      let hoyUvEstimado = false;
      let mananaUvEstimado = false;

      if (hoyUv == null || (base.clima.manana && mananaUv == null)) {
        try {
          const clouds = await this.openWeather.getCloudinessTodayAndTomorrow(
            details.beach.latitude,
            details.beach.longitude,
          );
          const est = (c: number | null) => {
            if (c == null) return null;
            return Math.max(1, Math.round(10 * (1 - c / 100)));
          };
          if (hoyUv == null && est(clouds.today) != null) {
            hoyUv = est(clouds.today);
            hoyUvEstimado = true;
          }
          if (base.clima.manana && mananaUv == null && est(clouds.tomorrow) != null) {
            mananaUv = est(clouds.tomorrow);
            mananaUvEstimado = true;
          }
          mananaUv = base.clima.manana ? mananaUv : null;
        } catch {
          // Optional enrichment: without OpenWeather cloudiness the UV keeps
          // whatever it already had (possibly null).
        }
      }

      let hoy: ClimaDiaDTO = { ...base.clima.hoy, uvIndex: hoyUv };
      if (hoyUvEstimado) hoy = this.marcarEstimado(hoy, 'uv');
      let manana = base.clima.manana ? { ...base.clima.manana, uvIndex: mananaUv } : null;
      if (manana && mananaUvEstimado) manana = this.marcarEstimado(manana, 'uv');
      base.clima = { ...base.clima, hoy, manana };
    }

    // Step 6: Derive waves from wind if still missing
    try {
      if (base.clima && !base.clima.hoy.waves) {
        const waves = this.wavesFromWind(details.weather?.windSpeedMs ?? null);
        if (waves) {
          base.clima = {
            ...base.clima,
            hoy: this.marcarEstimado({ ...base.clima.hoy, waves }, 'oleaje'),
          };
        }
      }
    } catch {
      // Optional enrichment: the waves just stay empty.
    }

    // Step 7: Water temperature fallback. The default is not a measurement of
    // anything: it is a plausible summer number so the row is not empty, and
    // it is marked as estimated precisely because it is indistinguishable
    // from a real reading once it is on screen.
    try {
      const DEFAULT_WATER_TEMP = 22;
      if (base.clima) {
        const hoyPorDefecto = base.clima.hoy.waterTemperature == null;
        const mananaPorDefecto = base.clima.manana != null && base.clima.manana.waterTemperature == null;
        const hoyWT = base.clima.hoy.waterTemperature ?? DEFAULT_WATER_TEMP;
        const mananaWT = base.clima.manana ? (base.clima.manana.waterTemperature ?? DEFAULT_WATER_TEMP) : null;
        const hoy: ClimaDiaDTO = { ...base.clima.hoy, waterTemperature: hoyWT };
        const manana = base.clima.manana
          ? { ...base.clima.manana, waterTemperature: mananaWT }
          : null;
        base.clima = {
          ...base.clima,
          hoy: hoyPorDefecto ? this.marcarEstimado(hoy, 'agua') : hoy,
          manana: manana && mananaPorDefecto ? this.marcarEstimado(manana, 'agua') : manana,
        };
      }
    } catch {
      // Optional enrichment: the water temperature just stays empty.
    }

    // Step 8: prediccionCompleta (only when scraper succeeded)
    base.prediccionCompleta = forecast ? this.mapForecastToDTO(forecast) : null;

    // Step 8.5: fill in sky/wind/waves that AEMET left empty ("nd") with
    // OpenWeather (free source). Only called if there are gaps → no cost when
    // AEMET is complete. Waves are estimated from wind (same as the summary card).
    if (base.prediccionCompleta && base.prediccionCompleta.dias.length > 0) {
      const hayHuecos = base.prediccionCompleta.dias.some((d) =>
        [d.manana, d.tarde].some((h) => h.cielo == null || h.viento == null || h.oleaje == null),
      );
      if (hayHuecos) {
        try {
          const ow = await this.openWeather.getForecastHalfDays(
            details.beach.latitude,
            details.beach.longitude,
            base.prediccionCompleta.dias.length,
          );
          base.prediccionCompleta = {
            ...base.prediccionCompleta,
            dias: base.prediccionCompleta.dias.map((d, i) => ({
              ...d,
              manana: this.rellenarMedioDia(d.manana, ow[i]?.manana),
              tarde: this.rellenarMedioDia(d.tarde, ow[i]?.tarde),
            })),
          };
        } catch {
          // OpenWeather unavailable: the forecast stays as is (with gaps)
        }
      }
    }

    // Step 9: If scraper failed entirely, try to recover tides from long-lived cache
    if (!base.prediccionCompleta) {
      const cached = this.aemetScraper.getCachedTides(details.beach.aemetCode);
      if (cached && cached.tides.length > 0) {
        base.prediccionCompleta = {
          fuente: 'AEMET_HTML',
          elaboracion: null,
          zonaAvisos: null,
          dias: [],
          mareas: cached.tides.map((t) => ({
            pleamar: t.highTide,
            bajamar: t.lowTide,
          })),
          fuenteMareas: cached.tidesSource,
        };
      }
    }

    // A `prediccionCompleta` with no days and no tides adds nothing and also
    // misrepresents the weather source in the UI: on beaches without an AEMET
    // page (e.g. synthetic code), the scraper's HTML fallback returns an empty
    // object with source 'AEMET_HTML'. It is nulled out so the detail reflects
    // the real source (`clima`, normally OpenWeather) instead of falsely
    // labeling AEMET.
    if (
      base.prediccionCompleta &&
      base.prediccionCompleta.dias.length === 0 &&
      base.prediccionCompleta.mareas.length === 0
    ) {
      base.prediccionCompleta = null;
    }

    // Step 10: A beach with no AEMET sheet has no tides of its own — borrow
    // the nearest beach that does. Tide tables are always relative to a
    // reference point anyway; on this coastline the shift a few km away is
    // one or two minutes, so this is honest, not a workaround. Kept separate
    // from `prediccionCompleta` (see the guard above): that field labels the
    // whole forecast column as AEMET's, which would misrepresent the source
    // for a beach that has none. Best-effort: any failure leaves it null,
    // same as a beach that simply has no reference.
    base.mareaReferencia = null;
    if (details.beach.sinAemet && this.beachRepo) {
      try {
        const catalog = await this.beachRepo.getAll();
        const reference = findTideReference(details.beach, catalog);
        if (reference) {
          const donorCode = reference.beach.aemetCode;
          const forecast = await this.aemetScraper.getBeachForecast(donorCode).catch(() => null);
          const tidesData =
            forecast && forecast.tides.length > 0
              ? { tides: forecast.tides, tidesSource: forecast.tidesSource }
              : this.aemetScraper.getCachedTides(donorCode);
          if (tidesData && tidesData.tides.length > 0) {
            base.mareaReferencia = {
              playa: reference.beach.name,
              municipio: reference.beach.municipality,
              distanciaKm: Math.round(reference.distanceKm * 10) / 10,
              mareas: tidesData.tides.map((t) => ({ pleamar: t.highTide, bajamar: t.lowTide })),
              fuenteMareas: tidesData.tidesSource,
            };
          }
        }
      } catch {
        // Reference unresolved: the detail ships without it, same as before this feature.
      }
    }

    // Stamped HERE, at the end of the only path that really calls the
    // providers. `assemble` answers from a stale-while-revalidate cache, so
    // this is the difference between "computed just now" and "served from a
    // copy made two hours ago" — which the client cannot deduce on its own.
    base.generadoEn = new Date().toISOString();
    // The ranking this detail's conditions come from, so the client can tell
    // whether the card it shows for this beach is the same picture.
    base.rankingGeneradoEn = details.rankingGeneradoEn != null
      ? new Date(details.rankingGeneradoEn).toISOString()
      : null;

    return base;
  }
}
