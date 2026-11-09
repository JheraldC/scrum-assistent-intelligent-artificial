import { createContext, useContext } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { ProjectDetail } from '../../api/types';
import { useResource } from '../../api/useResource';
import { AssistantProvider } from '../../components/agent/AssistantContext';
import { AssistantPanel } from '../../components/agent/AssistantPanel';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { es } from '../../i18n/es';

interface ProjectContextValue {
  project: ProjectDetail;
  reload: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error('useProject debe usarse dentro de ProjectLayout');
  return value;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm ${isActive ? 'bg-[var(--color-info-bg)] font-semibold text-[var(--color-info)]' : 'underline-offset-4 hover:underline'}`;

/** Marco común de las pantallas de un proyecto: cabecera y navegación. */
export function ProjectLayout() {
  const { projectId } = useParams();
  const { data, error, loading, reload } = useResource(
    (signal) => api<ProjectDetail>(`/projects/${projectId}`, { signal }),
    [projectId],
  );

  if (loading && !data) return <LoadingSkeleton />;
  if (error || !data) return <ErrorBanner message={error?.message ?? es.errors.notFound} onRetry={reload} />;

  return (
    <ProjectContext.Provider value={{ project: data, reload }}>
      <AssistantProvider>
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <p className="text-[var(--color-muted)]">{data.productGoal}</p>
          <p className="text-sm">
            {es.projects.myRole}: <strong>{es.projects.roles[data.myRole]}</strong>
            {data.isSample ? (
              <span className="ml-2 rounded bg-[var(--color-warning-bg)] px-2 text-[var(--color-warning)]">
                {es.projects.sample}
              </span>
            ) : null}
          </p>
        </header>
        <nav
          aria-label={es.nav.project}
          className="mb-6 flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2"
        >
          <NavLink end to={`/proyectos/${data.id}`} className={linkClass}>
            {es.nav.flow}
          </NavLink>
          <NavLink to={`/proyectos/${data.id}/backlog`} className={linkClass}>
            {es.nav.backlog}
          </NavLink>
          <NavLink to={`/proyectos/${data.id}/sprint/planificacion`} className={linkClass}>
            {es.nav.planning}
          </NavLink>
          <NavLink to={`/proyectos/${data.id}/sprint/retrospectiva`} className={linkClass}>
          {es.nav.retrospective}
        </NavLink>
        <NavLink to={`/proyectos/${data.id}/validaciones`} className={linkClass}>
            {es.nav.validations}
          </NavLink>
          <NavLink to={`/proyectos/${data.id}/participantes`} className={linkClass}>
            {es.nav.members}
          </NavLink>
          <NavLink to={`/proyectos/${data.id}/historial`} className={linkClass}>
            {es.nav.history}
          </NavLink>
          {data.myRole === 'FACILITATOR' ? (
            <NavLink to={`/proyectos/${data.id}/ajustes`} className={linkClass}>
              {es.nav.settings}
            </NavLink>
          ) : null}
        </nav>
        <Outlet />
        <AssistantPanel projectId={data.id} />
      </AssistantProvider>
    </ProjectContext.Provider>
  );
}
