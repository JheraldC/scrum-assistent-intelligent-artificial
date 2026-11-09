import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Activity } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

const PAGE = 50;

/** Historial cronológico de actividades (FR-004). La exportación se añade en la historia US6. */
export function HistoryPage() {
  const { project } = useProject();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      setError(null);
      try {
        const query = `limit=${PAGE}${before ? `&before=${before}` : ''}`;
        const page = await api<Activity[]>(`/projects/${project.id}/activity?${query}`);
        setItems((current) => (before ? [...current, ...page] : page));
        setHasMore(page.length === PAGE);
      } catch (err) {
        setError(err instanceof Error ? err.message : es.errors.generic);
      } finally {
        setLoading(false);
      }
    },
    [project.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{es.history.title}</h2>
      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
      {loading && items.length === 0 ? <LoadingSkeleton /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState title={es.history.empty} /> : null}
      {items.length > 0 ? (
        <ol className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
              <time dateTime={item.occurredAt} className="mr-2 font-mono text-[var(--color-muted)]">
                {new Date(item.occurredAt).toLocaleString('es')}
              </time>
              {es.history.actions[item.action] ?? item.action} {es.history.by}{' '}
              <span className="font-mono">{item.actorPseudonym ?? es.history.system}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {hasMore ? (
        <Button variant="secondary" className="mt-3" disabled={loading} onClick={() => void load(items[items.length - 1]?.id)}>
          {es.history.loadMore}
        </Button>
      ) : null}
    </section>
  );
}
