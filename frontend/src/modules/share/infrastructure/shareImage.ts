/** What actually happened, so the button can say it. */
export type ShareResult = 'conImagen' | 'soloEnlace' | 'enlaceCopiado' | 'cancelada';

/** Combining marks left behind by NFD — written as escapes, not as the marks
    themselves, which are invisible in an editor and get mangled on edit. */
const LOOSE_ACCENTS = new RegExp('[\\u0300-\\u036f]', 'g');

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
export async function shareBeach({
  image,
  fileName,
  title,
  url,
}: {
  image: Blob | null;
  fileName: string;
  title: string;
  url: string;
}): Promise<ShareResult> {
  if (image && navigator.share) {
    const file = new File([image], fileName, { type: image.type || 'image/png' });
    // The URL travels as the text so it lands in the caption: a target that
    // takes files often drops a separate `url`, and then the card would leave
    // with no way back to the app.
    const load = { files: [file], title, text: url };
    // `canShare` is the only honest check: a browser can have `share` and still
    // refuse files, and calling `share` then throws after the user has tapped.
    if (navigator.canShare?.(load)) {
      try {
        await navigator.share(load);
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
      await navigator.share({ title, url });
      return 'soloEnlace';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'cancelada';
    }
  }

  await navigator.clipboard.writeText(url);
  return 'enlaceCopiado';
}

/** Filename the receiver ends up seeing: beach and day, no ids. */
export function cardFileName(beachName: string, now: Date): string {
  const clean = beachName
    .normalize('NFD')
    .replace(LOOSE_ACCENTS, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `${clean || 'playa'}-${day}.png`;
}
