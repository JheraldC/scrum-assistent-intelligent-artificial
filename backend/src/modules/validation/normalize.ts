// Normalización de texto para las reglas: minúsculas, sin tildes ni signos (rules-catalog.md).

/** Minúsculas, sin tildes ni diacríticos, signos reemplazados por espacios y espacios colapsados. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras normalizadas (sin vacías). */
export function words(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized === '' ? [] : normalized.split(' ');
}

/** Número de palabras del texto original (secuencias separadas por espacios con algún carácter alfanumérico). */
export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Similitud de Jaccard entre los conjuntos de palabras de dos textos (0 a 1). */
export function jaccard(a: string, b: string): number {
  const sa = new Set(words(a));
  const sb = new Set(words(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}
