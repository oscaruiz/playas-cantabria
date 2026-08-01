import regionData from '../data/region.json';

/**
 * The region this build serves. Written by `scripts/sync-region.mjs` from root
 * `regions/<id>/region.json` before every start/build and canonical test, so the same code
 * produces the Cantabria app or the Asturias one depending on
 * `REACT_APP_REGION`.
 *
 * Never hardcode a region name, a map centre or an API path anywhere else:
 * this module is the only place that knows which region is being built.
 */
export interface RegionConfig {
  id: string;
  name: string;
  branding: {
    appName: string;
    shortName: string;
    themeColor: string;
    backgroundColor: string;
    capacitorAppId: string;
  };
  map: {
    center: { lat: number; lon: number };
    zoom: number;
  };
}

export const REGION: RegionConfig = regionData;

/** Leading path of this region's API (`/api/cantabria`). */
export const REGION_API_PATH = `/api/${REGION.id}`;
