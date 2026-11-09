import { useState } from 'react';
import { api } from '../../api/client';
import type { BacklogItem, ValidationRun } from '../../api/types';
import { useCatalogTitles } from '../../api/useCatalogTitles';
import { useResource } from '../../api/useResource';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { GateResultPanel, RunStatusBadge } from '../../components/validation/GateResultPanel';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

function RunItem({ run, label, titles }: { run: ValidationRun; label: string; titles: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <details onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="flex cursor-pointer flex-wrap items-center gap-3">
          <span className="font-medium">
            {es.gate.attempt} {run.attemptNo}
          </span>
          <RunStatusBadge status={run.status} />
          <span className="text-sm text-[var(--color-muted)]">
            {label} · <time dateTime={run.finishedAt}>{new Date(run.finishedAt).toLocaleString('es')}</time>
          </span>
        </summary>
        {open ? <GateResultPanel run={run} titles={titles} /> : null}
      </details>
    </li>
  );
}

/** Historial de evaluaciones del proyecto: cada intento con su evidencia (FR-015). */
export function ValidationsPage() {
  const { project } = useProject();
  const titles = useCatalogTitles();
  const runs = useResource((signal) => api<ValidationRun[]>(`/projects/${project.id}/validations`, { signal }), [project.id]);
  const items = useResource((signal) => api<BacklogItem[]>(`/projects/${project.id}/backlog`, { signal }), [project.id]);
  const codes = new Map((items.data ?? []).map((i) => [i.id, `${i.code} · ${i.title}`]));

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{es.validations.title}</h2>
      {runs.loading ? <LoadingSkeleton /> : null}
      {runs.error ? <ErrorBanner message={runs.error.message} onRetry={runs.reload} /> : null}
      {runs.data && runs.data.length === 0 ? <EmptyState title={es.validations.empty} description={es.validations.emptyHelp} /> : null}
      {runs.data && runs.data.length > 0 ? (
        <ol className="space-y-2">
          {[...runs.data]
            .sort((a, b) => a.targetId.localeCompare(b.targetId) || a.attemptNo - b.attemptNo)
            .map((run) => (
              <RunItem key={run.id} run={run} label={codes.get(run.targetId) ?? run.targetType} titles={titles} />
            ))}
        </ol>
      ) : null}
    </section>
  );
}
