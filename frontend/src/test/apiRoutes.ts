import { REGION_API_PATH } from '../shared/config/region';

/**
 * The endpoints the app really calls, derived from the region being built.
 *
 * Shared so no test hardcodes `cantabria`: the suite has to keep passing when
 * the build is `REACT_APP_REGION=asturias`, and a literal here would silently
 * turn into a test that only ever checks one region.
 */

/** Only `/beaches`, without catching `/beaches/featured` or the details. */
export const BEACHES_PATH = new RegExp(`${REGION_API_PATH}/beaches$`);

export const FEATURED_PATH = `${REGION_API_PATH}/beaches/featured`;

export const DETAIL_PATH = new RegExp(`${REGION_API_PATH}/beaches/[^/]+/details$`);
