/** What actually happened, so the button can say it. */
export type ResultadoCompartir = 'conImagen' | 'soloEnlace' | 'enlaceCopiado' | 'cancelada';

/** Combining marks left behind by NFD — written as escapes, not as the marks
    themselves, which are invisible in an editor and get mangled on edit. */
const TILDES_SUELTAS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * One share, degrading in three steps: the card WITH the link, the link alone,
 * and the link on the clipboard.
 *
 * They are steps of the same action and not separate buttons on purpose. Two
 * buttons made the user choose between "link" and "image" before knowing what
 * their own phone could do with either — and the honest answer is that the
 * image is a bonus of the platform, not a different intention. What is being
 * shared is the beach; how much of it travels is up to the share sheet.
 */
export async function compartirPlaya({
  imagen,
  nombreArchivo,
  titulo,
  url,
}: {
  imagen: Blob | null;
  nombreArchivo: string;
  titulo: string;
  url: string;
}): Promise<ResultadoCompartir> {
  if (imagen && navigator.share) {
    const archivo = new File([imagen], nombreArchivo, { type: imagen.type || 'image/png' });
    // The URL travels as the text so it lands in the caption: a target that
    // takes files often drops a separate `url`, and then the card would leave
    // with no way back to the app.
    const carga = { files: [archivo], title: titulo, text: url };
    // `canShare` is the only honest check: a browser can have `share` and still
    // refuse files, and calling `share` then throws after the user has tapped.
    if (navigator.canShare?.(carga)) {
      try {
        await navigator.share(carga);
        return 'conImagen';
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return 'cancelada';
        // Anything else and we still owe them the link, which is the minimum
        // this button promised long before the card existed.
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, url });
      return 'soloEnlace';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'cancelada';
    }
  }

  await navigator.clipboard.writeText(url);
  return 'enlaceCopiado';
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
