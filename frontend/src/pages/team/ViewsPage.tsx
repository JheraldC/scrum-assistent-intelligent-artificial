import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Decision, DevelopersView, Member, ProductOwnerView, ScrumMasterView, ScrumResponsibilityValue, StageSummary } from '../../api/types';
import { useResource } from '../../api/useResource';
import { useSession } from '../../app/SessionProvider';
import { useAssistant } from '../../components/agent/AssistantContext';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { TasksPanel } from '../../components/team/TasksPanel';
import { GateStateBadge } from '../../components/validation/GateStateBadge';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

type Role = 'scrum-master' | 'product-owner' | 'developers';
const ROLES: Role[] = ['scrum-master', 'product-owner', 'developers'];
const BY_RESPONSIBILITY: Record<ScrumResponsibilityValue, Role> = { SCRUM_MASTER: 'scrum-master', PRODUCT_OWNER: 'product-owner', DEVELOPER: 'developers' };

const card = 'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3';

function Stages({ stages }: { stages: StageSummary[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {stages.map((s) => (
        <li key={s.type} className={card} data-stage={s.type} data-status={s.status}>
          <p className="font-medium">{es.flow.stages[s.type as keyof typeof es.flow.stages].name}</p>
          <p className="text-sm">
            {es.flow.stageStatus[s.status as keyof typeof es.flow.stageStatus]}
            {s.gateState ? (
              <>
                {' '}
                · <GateStateBadge state={s.gateState} />
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Header({ goal, dod, productGoal }: { goal?: string | null; dod: string; productGoal: string }) {
  return (
    <div className="mb-4 grid gap-2 md:grid-cols-2">
      <div className={card}>
        <h3 className="text-sm font-semibold">{es.views.productGoal}</h3>
        <p>{productGoal}</p>
      </div>
      <div className={card}>
        <h3 className="text-sm font-semibold">{es.views.dod}</h3>
        <p className="whitespace-pre-wrap">{dod.trim() !== '' ? dod : es.projects.noDod}</p>
      </div>
      {goal !== undefined ? (
        <div className={`${card} md:col-span-2`}>
          <h3 className="text-sm font-semibold">{es.views.sprintGoal}</h3>
          <p>{goal && goal.trim() !== '' ? goal : es.views.noGoal}</p>
        </div>
      ) : null}
    </div>
  );
}

function ScrumMasterPanel({ projectId }: { projectId: string }) {
  const { send } = useAssistant();
  const { data, error, loading, reload } = useResource((signal) => api<ScrumMasterView>(`/projects/${projectId}/views/scrum-master`, { signal }), [projectId]);
  if (loading && !data) return <LoadingSkeleton />;
  if (error || !data) return <ErrorBanner message={error?.message ?? es.errors.generic} onRetry={reload} />;
  return (
    <div data-view="scrum-master">
      <Header goal={data.sprint ? data.sprint.sprintGoal : null} dod={data.project.definitionOfDone} productGoal={data.project.productGoal} />
      {data.sprint ? (
        <section className="mb-4" aria-labelledby="sm-estado">
          <h3 id="sm-estado" className="mb-2 text-lg font-semibold">
            {es.views.stages} · {es.flow.sprintLabel} {data.sprint.number}
          </h3>
          <Stages stages={data.sprint.stages} />
        </section>
      ) : (
        <p className="mb-4">{es.views.noSprint}</p>
      )}

      <section className="mb-4" aria-labelledby="sm-atencion">
        <h3 id="sm-atencion" className="text-lg font-semibold">
          {es.views.attention}
        </h3>
        <p className="mb-2 text-sm text-[var(--color-muted)]">{es.views.attentionNote}</p>
        {data.attention.length === 0 ? <p>{es.views.noAttention}</p> : null}
        <ul className="space-y-1">
          {data.attention.map((a) => (
            <li key={a.code} data-attention={a.code} className={`${card} text-sm`}>
              <span aria-hidden="true">{a.severity === 'warning' ? '⚠ ' : 'ℹ '}</span>
              {a.message}
              {a.count ? <strong> ({a.count})</strong> : null}
            </li>
          ))}
        </ul>
        <Button variant="secondary" className="mt-2" onClick={() => void send(es.views.facilitationPrompt)}>
          {es.views.facilitation}
        </Button>
      </section>

      <section className="mb-4" aria-labelledby="sm-imp">
        <h3 id="sm-imp" className="mb-2 text-lg font-semibold">
          {es.views.impediments}
        </h3>
        {data.impediments.length === 0 ? <p>{es.views.noImpediments}</p> : null}
        <ul className="space-y-1">
          {data.impediments.map((i) => (
            <li key={i.id} className={`${card} text-sm`}>
              {i.content} <span className="text-[var(--color-muted)]">· {es.views.since} {new Date(i.createdAt).toLocaleDateString('es')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4" aria-labelledby="sm-retro">
        <h3 id="sm-retro" className="mb-2 text-lg font-semibold">
          {es.views.retroActions}
        </h3>
        {data.retroActions.length === 0 ? <p>{es.views.noRetroActions}</p> : null}
        <ul className="space-y-1">
          {data.retroActions.map((a) => (
            <li key={a.id} className={`${card} text-sm`}>
              {a.description} <span className="text-[var(--color-muted)]">· Sprint {a.sprintNumber}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sm-dec">
        <h3 id="sm-dec" className="mb-2 text-lg font-semibold">
          {es.views.decisions}
        </h3>
        {data.decisions.length === 0 ? <p>{es.views.noDecisions}</p> : null}
        <ul className="space-y-1">
          {data.decisions.map((d) => (
            <li key={d.id} className={`${card} text-sm`}>
              <strong>{es.decisions.kinds[d.kind]}:</strong> {d.text}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          <Link className="underline" to="../../decisiones" relative="path">
            {es.views.allDecisions}
          </Link>
        </p>
      </section>
    </div>
  );
}

function ProductOwnerPanel({ projectId }: { projectId: string }) {
  const { data, error, loading, reload } = useResource((signal) => api<ProductOwnerView>(`/projects/${projectId}/views/product-owner`, { signal }), [projectId]);
  if (loading && !data) return <LoadingSkeleton />;
  if (error || !data) return <ErrorBanner message={error?.message ?? es.errors.generic} onRetry={reload} />;
  return (
    <div data-view="product-owner">
      <Header dod={data.project.definitionOfDone} productGoal={data.project.productGoal} />
      <section className="mb-4" aria-labelledby="po-backlog">
        <h3 id="po-backlog" className="mb-2 text-lg font-semibold">
          {es.views.backlog}
        </h3>
        {data.backlog.length === 0 ? <EmptyState title={es.views.emptyBacklog} /> : null}
        <ol className="space-y-2">
          {data.backlog.map((b) => (
            <li key={b.id} data-item={b.code} className={`${card} text-sm`}>
              <p className="font-medium">
                {b.priority}. <span className="font-mono">{b.code}</span> · {b.title}{' '}
                {b.inSprint ? <span className="ml-1 rounded bg-[var(--color-info-bg)] px-2 text-xs text-[var(--color-info)]">{es.views.inSprint}</span> : null}{' '}
                <GateStateBadge state={b.gateState} />
              </p>
              {b.iWant ? (
                <p className="text-[var(--color-muted)]">
                  {b.asA ? `Como ${b.asA}, ` : ''}quiero {b.iWant}
                  {b.soThat ? `, para ${b.soThat}` : ''}
                </p>
              ) : null}
              <p className="mt-1">
                <strong>{es.views.criteria}:</strong> {b.acceptanceCriteria.length === 0 ? es.views.noCriteria : ''}
              </p>
              {b.acceptanceCriteria.length > 0 ? (
                <ul className="list-disc pl-5">
                  {b.acceptanceCriteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {b.needsClarification ? (
                <p className="mt-1 text-[var(--color-warning)]">
                  <span aria-hidden="true">⚠ </span>
                  <strong>{es.views.needsClarity}:</strong> {b.reasons.join('; ')}
                </p>
              ) : null}
              <p className="mt-1">
                <Link className="underline" to={`../../backlog/${b.id}`} relative="path">
                  {b.code}
                </Link>
              </p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="po-review">
        <h3 id="po-review" className="mb-2 text-lg font-semibold">
          {es.views.reviewFeedback}
        </h3>
        {data.reviewFeedback.length === 0 ? <p>{es.views.noReview}</p> : null}
        <ul className="space-y-2">
          {data.reviewFeedback.map((r) => (
            <li key={r.sprintNumber} className={`${card} text-sm`}>
              <p className="font-medium">Sprint {r.sprintNumber}</p>
              <p className="whitespace-pre-wrap">{r.feedback.trim() !== '' ? r.feedback : r.results}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DevelopersPanel({ projectId }: { projectId: string }) {
  const { data, error, loading, reload } = useResource((signal) => api<DevelopersView>(`/projects/${projectId}/views/developers`, { signal }), [projectId]);
  if (loading && !data) return <LoadingSkeleton />;
  if (error || !data) return <ErrorBanner message={error?.message ?? es.errors.generic} onRetry={reload} />;
  if (!data.sprint) return <EmptyState title={es.views.noSprint} />;
  return (
    <div data-view="developers">
      <Header goal={data.sprint.sprintGoal} dod={data.project.definitionOfDone} productGoal={data.project.productGoal} />
      <section className="mb-4" aria-labelledby="dev-plan">
        <h3 id="dev-plan" className="mb-2 text-lg font-semibold">
          {es.views.workPlan}
        </h3>
        <p className={`${card} whitespace-pre-wrap text-sm`}>{data.sprint.workPlan.trim() !== '' ? data.sprint.workPlan : es.views.noPlan}</p>
      </section>
      <section className="mb-4" aria-labelledby="dev-sel">
        <h3 id="dev-sel" className="mb-2 text-lg font-semibold">
          {es.views.selected}
        </h3>
        {data.items.length === 0 ? <p>{es.views.noSelected}</p> : null}
        <ul className="space-y-2">
          {data.items.map((i) => (
            <li key={i.id} className={`${card} text-sm`}>
              <p className="font-medium">
                <span className="font-mono">{i.code}</span> · {i.title}
              </p>
              {i.acceptanceCriteria.length > 0 ? (
                <ul className="list-disc pl-5">
                  {i.acceptanceCriteria.map((c, n) => (
                    <li key={n}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          {es.views.tasksSummary}: {es.team.statuses.TODO} {data.summary.todo} · {es.team.statuses.DOING} {data.summary.doing} · {es.team.statuses.DONE} {data.summary.done}
        </p>
      </section>
      <section className="mb-4" aria-labelledby="dev-imp">
        <h3 id="dev-imp" className="mb-2 text-lg font-semibold">
          {es.views.impediments}
        </h3>
        {data.impediments.length === 0 ? <p>{es.views.noImpediments}</p> : null}
        <ul className="space-y-1">
          {data.impediments.map((i) => (
            <li key={i.id} className={`${card} text-sm`}>
              {i.content}
            </li>
          ))}
        </ul>
      </section>
      <TasksPanel projectId={projectId} sprintId={data.sprint.id} itemIds={data.items.map((i) => i.id)} onChanged={reload} />
    </div>
  );
}

/** Objetivos, acuerdos y decisiones recientes: visibles para todo el equipo en cualquier vista. */
function SharedDecisions({ projectId }: { projectId: string }) {
  const { data } = useResource((signal) => api<Decision[]>(`/projects/${projectId}/decisions`, { signal }), [projectId]);
  const recent = (data ?? []).slice(0, 5);
  return (
    <section className="mt-6" aria-labelledby="comun-dec">
      <h3 id="comun-dec" className="mb-2 text-lg font-semibold">
        {es.views.decisions}
      </h3>
      {recent.length === 0 ? <p className="text-sm">{es.views.noDecisions}</p> : null}
      <ul className="space-y-1">
        {recent.map((d) => (
          <li key={d.id} className={`${card} text-sm`}>
            <strong>{es.decisions.kinds[d.kind]}:</strong> {d.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Vistas por responsabilidad Scrum (Scrum Master, Product Owner y Developers); visibles para todo el equipo. */
export function ViewsPage() {
  const { project } = useProject();
  const { user } = useSession();
  const { rol } = useParams();
  const members = useResource((signal) => api<Member[]>(`/projects/${project.id}/members`, { signal }), [project.id]);

  const mine = members.data?.find((m) => m.userId === user?.id)?.responsibilities ?? [];
  const defaultRole = mine.length > 0 ? BY_RESPONSIBILITY[mine[0]!] : 'scrum-master';
  if (!rol) {
    if (members.loading && !members.data) return <LoadingSkeleton />;
    return <Navigate to={`/proyectos/${project.id}/vistas/${defaultRole}`} replace />;
  }
  if (!ROLES.includes(rol as Role)) return <EmptyState title={es.errors.notFound} />;
  const active = rol as Role;

  return (
    <section className="max-w-4xl">
      <h2 className="mb-1 text-xl font-semibold">{es.views.title}</h2>
      <p className="mb-3 text-sm text-[var(--color-muted)]">{es.views.intro}</p>
      <div role="tablist" aria-label={es.views.title} className="mb-4 flex flex-wrap gap-1 border-b border-[var(--color-border)]">
        {ROLES.map((r) => {
          const isMine = mine.includes(Object.entries(BY_RESPONSIBILITY).find(([, v]) => v === r)![0] as ScrumResponsibilityValue);
          return (
            <Link
              key={r}
              role="tab"
              aria-selected={active === r}
              to={`/proyectos/${project.id}/vistas/${r}`}
              className={`min-h-11 px-4 py-2 text-sm ${active === r ? 'border-b-2 border-[var(--color-info)] font-semibold text-[var(--color-info)]' : 'underline-offset-4 hover:underline'}`}
            >
              {es.views.tabs[r]}
              {isMine ? <span className="ml-1 text-xs">({es.views.yours})</span> : null}
            </Link>
          );
        })}
      </div>
      {active === 'scrum-master' ? <ScrumMasterPanel projectId={project.id} /> : null}
      {active === 'product-owner' ? <ProductOwnerPanel projectId={project.id} /> : null}
      {active === 'developers' ? <DevelopersPanel projectId={project.id} /> : null}
      {active !== 'scrum-master' ? <SharedDecisions projectId={project.id} /> : null}
    </section>
  );
}
