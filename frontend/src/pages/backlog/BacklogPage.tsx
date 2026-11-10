import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { BacklogItem } from '../../api/types';
import { useResource } from '../../api/useResource';
import { GateStateBadge } from '../../components/validation/GateStateBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

const linkButton =
  'min-h-11 inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)]';

/** Product Backlog ordenado con el estado de la última evaluación de cada elemento (FR-008). */
export function BacklogPage() {
  const { project } = useProject();
  const { data, error, loading, reload } = useResource(
    (signal) => api<BacklogItem[]>(`/projects/${project.id}/backlog`, { signal }),
    [project.id],
  );
  const base = `/proyectos/${project.id}/backlog`;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{es.backlog.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Link to={`${base}/nuevo`} className="min-h-11 inline-flex items-center rounded-md bg-[var(--color-primary)] px-4 py-2 text-[var(--color-primary-contrast)]">
            {es.backlog.newStory}
          </Link>
        </div>
      </div>
      <details className="mb-4 rounded-md border border-dashed border-[var(--color-border)] p-3 text-sm" data-other-kind>
        <summary className="min-h-6 cursor-pointer font-medium">{es.backlog.otherKind}</summary>
        <p className="mt-2">{es.backlog.otherKindHelp}</p>
        <Link to={`${base}/nuevo?tipo=ITEM`} className={`${linkButton} mt-2`}>
          {es.backlog.otherKindCreate}
        </Link>
      </details>
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorBanner message={error.message} onRetry={reload} /> : null}
      {data && data.length === 0 ? <EmptyState title={es.backlog.empty} description={es.backlog.emptyHelp} /> : null}
      {data && data.length > 0 ? (
        <ol className="space-y-2">
          {data.map((item) => (
            <li key={item.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm text-[var(--color-muted)]">{item.code}</span>
                <Link to={`${base}/${item.id}`} className="font-medium underline-offset-4 hover:underline">
                  {item.title}
                </Link>
                <span className="text-sm text-[var(--color-muted)]">
                  {es.backlog.kind[item.kind]} · {es.backlog.fields.priority} {item.priority}
                </span>
                <span className="ml-auto">
                  <GateStateBadge state={item.gateState} />
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
