import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { ProjectSummary } from '../../api/types';
import { useResource } from '../../api/useResource';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { es } from '../../i18n/es';

const statusIcon: Record<string, string> = {
  SIN_SPRINT: '○',
  EN_CURSO: '◔',
  REQUIERE_CORRECCION: '⚠',
  CERRADO: '✓',
};

/** Panel de proyectos: rol y estado derivado de cada uno (FR-002, FR-004). */
export function ProjectsPage() {
  const { data, error, loading, reload } = useResource((signal) => api<ProjectSummary[]>('/projects', { signal }), []);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{es.projects.title}</h1>
        <Link
          to="/proyectos/nuevo"
          className="min-h-11 rounded-md bg-[var(--color-primary)] px-4 py-2 text-[var(--color-primary-contrast)]"
        >
          {es.projects.create}
        </Link>
      </div>
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorBanner message={error.message} onRetry={reload} /> : null}
      {data && data.length === 0 ? (
        <EmptyState title={es.projects.emptyTitle} description={es.projects.emptyDescription} />
      ) : null}
      {data && data.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((project) => (
            <li key={project.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="text-lg font-semibold">
                <Link to={`/proyectos/${project.id}`} className="underline-offset-4 hover:underline">
                  {project.name}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{project.productGoal}</p>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  {es.projects.myRole}: <strong>{es.projects.roles[project.myRole]}</strong>
                </span>
                <span>
                  <span aria-hidden="true">{statusIcon[project.status]} </span>
                  {es.projects.status[project.status]}
                </span>
                {project.isSample ? (
                  <span className="rounded bg-[var(--color-warning-bg)] px-2 text-[var(--color-warning)]">
                    {es.projects.sample}
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
