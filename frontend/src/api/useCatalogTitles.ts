import { api } from './client';
import type { CriteriaCatalog } from './types';
import { useResource } from './useResource';

/** Títulos de criterio por identificador, tomados del catálogo del servidor (FR-017). */
export function useCatalogTitles(): Record<string, string> {
  const { data } = useResource((signal) => api<CriteriaCatalog>('/criteria-catalog', { signal }), []);
  const titles: Record<string, string> = {};
  for (const gate of data?.gates ?? []) for (const c of gate.criteria) titles[c.id] = c.title;
  return titles;
}
