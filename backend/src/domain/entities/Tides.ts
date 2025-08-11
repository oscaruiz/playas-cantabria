export interface TideEvent {
  time: number; // Unix epoch (ms)
  heightMeters: number | null;
  type: 'HIGH' | 'LOW';
}

export interface Tides {
  events: TideEvent[];
  source: 'N/A' | 'ProviderX';
}
