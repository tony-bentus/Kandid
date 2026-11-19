/**
 * Escapa todo texto que vem do snapshot antes de qualquer emissão em HTML.
 *
 * A ordem importa: `&` precisa ser o primeiro para não escapar as entidades
 * geradas nas substituições seguintes. A função é pura e não altera a entrada.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
