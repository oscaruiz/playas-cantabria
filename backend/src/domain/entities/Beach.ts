export interface Beach {
  /** Internal beach id: we’ll use the AEMET `codigo` from the static JSON. */
  id: string;
  name: string;
  municipality: string;
  aemetCode: string;
  latitude: number;
  longitude: number;
  /** Red Cross beach id; 0 or undefined means “no Red Cross record”. */
  redCrossId?: number;
}
