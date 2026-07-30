/**
 * OBSERVED sunshine at a station: minutes of sun recorded during the previous
 * hour.
 *
 * It is the only sky signal we have that does not come out of a model. The
 * models (OpenWeather, Open-Meteo, met.no, AEMET's beach forecast) share the
 * same blind spot: a marine stratus layer hugging the coast fits entirely
 * inside a cell of their grid and disappears. Several of them agreeing on
 * "clear" is not corroboration, it is the same error repeated.
 */
export interface SunshineObservation {
  /** Minutes of sun in the last hour, 0-60. */
  insoMin: number;
  /** `insoMin / 60`, precomputed for the decider's convenience. */
  fraccion: number;
  /** Distance from the station to the queried beach. */
  distanciaKm: number;
  /** AEMET identifier of the station (e.g. "1111X"). */
  idema: string;
  /** Readable name, for diagnostics. */
  ubicacion: string | null;
  /** Epoch (ms) of the observation (`fint`), NOT of when we downloaded it. */
  observadoEn: number;
}
