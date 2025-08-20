export const DEBUG_WEATHER = process.env.DEBUG_WEATHER === '1';

export function debugLog(tag: string, payload: unknown) {
  if (!DEBUG_WEATHER) return;
  try {
    console.debug(`[DEBUG] ${tag}: ${JSON.stringify(payload).slice(0, 4000)}`);
  } catch {
    console.debug(`[DEBUG] ${tag}: [unserializable payload]`);
  }
}
