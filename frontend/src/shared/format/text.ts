/** Text formatting with no domain knowledge. */

export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\uFFFD/g, 'e');
}

export function capitalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
