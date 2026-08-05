/** What actually happened, so the button can say it. */
export type ResultadoCompartir = 'compartida' | 'descargada' | 'cancelada';

/** Combining marks left behind by NFD — written as escapes, not as the marks
    themselves, which are invisible in an editor and get mangled on edit. */
const TILDES_SUELTAS = new RegExp('[\\u0300-\\u036f]', 'g');

function descargar(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Revoked on the next tick: Safari cancels the download if the URL dies
  // while the click is still being processed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Native share sheet with the image attached — that is the route to WhatsApp —
 * and a plain download where the platform has no such sheet (every desktop
 * browser, and Firefox on Android). It never fails silently: if sharing breaks
 * for any reason other than the user dismissing it, the image is downloaded so
 * it is not simply lost.
 */
export async function compartirImagen(
  blob: Blob,
  nombreArchivo: string,
  titulo: string,
  texto: string,
): Promise<ResultadoCompartir> {
  const archivo = new File([blob], nombreArchivo, { type: blob.type || 'image/png' });

  // `canShare` is the only honest check: a browser can have `share` and still
  // refuse files, and calling `share` then throws after the user has tapped.
  if (navigator.share && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: titulo, text: texto });
      return 'compartida';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'cancelada';
    }
  }

  descargar(blob, nombreArchivo);
  return 'descargada';
}

/** Filename the receiver ends up seeing: beach and day, no ids. */
export function nombreArchivoTarjeta(nombrePlaya: string, ahora: Date): string {
  const limpio = nombrePlaya
    .normalize('NFD')
    .replace(TILDES_SUELTAS, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const dia = [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, '0'),
    String(ahora.getDate()).padStart(2, '0'),
  ].join('-');
  return `${limpio || 'playa'}-${dia}.png`;
}
