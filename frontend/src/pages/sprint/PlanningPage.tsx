import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { BacklogItem, Sprint, ValidationRun } from '../../api/types';
import { EvaluationSummary, RecommendButton } from '../../components/agent/AiActions';
import { useAssistant, useAssistantFocus } from '../../components/agent/AssistantContext';
import { CeremonyHelp } from '../../components/team/CeremonyHelp';
import { TasksPanel } from '../../components/team/TasksPanel';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { Toast } from '../../components/ui/Toast';
import { VersionConflictDialog } from '../../components/ui/VersionConflictDialog';
import { ExceptionDialog } from '../../components/validation/ExceptionDialog';
import { GateStateBadge } from '../../components/validation/GateStateBadge';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

/** Planificación del Sprint: objetivo, elementos, plan, evaluación de la compuerta y avance (FR-011–FR-017). */
export function PlanningPage() {
  const { project, reload } = useProject();
  const sprint: Sprint | null = project.openSprint;
  const { reportEvaluation } = useAssistant();
  const isFacilitator = project.myRole === 'FACILITATOR';

  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [goal, setGoal] = useState(sprint?.sprintGoal ?? '');
  const [plan, setPlan] = useState(sprint?.workPlan ?? '');
  const [selected, setSelected] = useState<string[]>(sprint?.itemIds ?? []);
  const [dirty, setDirty] = useState(false);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [busy, setBusy] = useState<'save' | 'evaluate' | 'complete' | null>(null);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [conflict, setConflict] = useState<Sprint | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [askException, setAskException] = useState(false);

  useAssistantFocus(sprint ? { targetType: 'SPRINT', targetId: sprint.id, label: `Sprint ${sprint.number} · planificación` } : null);

  const planning = sprint?.stages.find((s) => s.type === 'PLANNING');
  const gateState = planning?.gateState ?? 'NO_EVALUADA';
  const validated = planning?.status === 'VALIDATED';
  const canComplete = !validated && (gateState === 'APROBADA' || gateState === 'APROBADA_CON_EXCEPCION');

  useEffect(() => {
    api<BacklogItem[]>(`/projects/${project.id}/backlog`).then(setBacklog).catch(() => undefined);
  }, [project.id]);

  // La última evaluación del Sprint (para mostrar resultados al volver a la pantalla).
  useEffect(() => {
    if (!sprint) return;
    api<ValidationRun[]>(`/projects/${project.id}/validations?targetType=SPRINT&targetId=${sprint.id}`)
      .then((runs) => setRun((current) => current ?? runs[0] ?? null))
      .catch(() => undefined);
  }, [project.id, sprint?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function adopt(next: Sprint) {
    setGoal(next.sprintGoal);
    setPlan(next.workPlan);
    setSelected(next.itemIds);
    setDirty(false);
  }

  // Si otra persona (o una propuesta aceptada) cambió el Sprint, el formulario se actualiza con la versión guardada.
  useEffect(() => {
    if (sprint) adopt(sprint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprint?.version]);

  if (!sprint) return <EmptyState title={es.planning.noSprint} />;
  const closed = sprint.status === 'CLOSED';

  async function run_<T>(kind: 'save' | 'evaluate' | 'complete', action: () => Promise<T>): Promise<T | undefined> {
    setBusy(kind);
    setFailure(null);
    try {
      return await action();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') setConflict(error.current as Sprint);
      else setFailure(toFormFailure(error));
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const saved = await run_('save', async () => {
      const patched = await api<Sprint>(`/projects/${project.id}/sprints/${sprint!.id}`, {
        method: 'PATCH',
        body: { sprintGoal: goal, workPlan: plan, expectedVersion: sprint!.version },
      });
      return api<Sprint>(`/projects/${project.id}/sprints/${sprint!.id}/items`, {
        method: 'PUT',
        body: { itemIds: selected, expectedVersion: patched.version },
      });
    });
    if (saved) {
      adopt(saved);
      setNotice(es.planning.saved);
      reload();
    }
  }

  async function onEvaluate() {
    const result = await run_('evaluate', () =>
      api<ValidationRun>(`/projects/${project.id}/validations`, {
        method: 'POST',
        body: { gateId: 'GATE-PLAN', targetType: 'SPRINT', targetId: sprint!.id },
      }),
    );
    if (result) {
      setRun(result);
      reportEvaluation(result, `Planificación del Sprint ${sprint!.number}`, { artifactType: 'SPRINT', artifactId: sprint!.id, label: `Planificación del Sprint ${sprint!.number}` });
      setAskException(false);
      reload();
    }
  }

  async function onComplete() {
    const done = await run_('complete', () =>
      api(`/projects/${project.id}/sprints/${sprint!.id}/stages/PLANNING/complete`, { method: 'POST' }),
    );
    if (done) {
      setNotice(es.planning.completed);
      reload();
    }
  }

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    setDirty(true);
  };

  const showException = isFacilitator && run?.status === 'FAILED' && gateState === 'NO_APROBADA' && !validated;

  return (
    <section className="max-w-3xl">
      <h2 className="mb-1 text-xl font-semibold">
        {es.planning.title} · {es.flow.sprintLabel} {sprint.number}
      </h2>
      <p className="mb-2 text-sm text-[var(--color-muted)]">{es.planning.intro}</p>
      <details className="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
        <summary className="min-h-6 cursor-pointer font-medium">{es.planning.backlogsTitle}</summary>
        <p className="mt-2">{es.planning.backlogsText}</p>
      </details>
      <CeremonyHelp ceremony="PLANNING" />
      <p className="mb-3 flex flex-wrap items-center gap-2">
        <GateStateBadge state={gateState} />
        {validated ? <span className="font-medium text-[var(--color-success)]">✓ {es.planning.validated}</span> : null}
      </p>
      <p className="mb-4 text-sm text-[var(--color-muted)]">{es.planning.gateBlocks}</p>

      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}
      {conflict ? (
        <VersionConflictDialog
          title={es.planning.conflictTitle}
          body={es.planning.conflictBody}
          reloadLabel={es.planning.conflictReload}
          keepLabel={es.planning.conflictKeep}
          onReload={() => {
            adopt(conflict);
            setConflict(null);
            reload();
          }}
          onKeep={() => {
            setConflict(null);
            reload();
          }}
        />
      ) : null}

      <form onSubmit={onSave} noValidate>
        <FormField
          multiline
          rows={2}
          label={es.planning.sprintGoal}
          name="sprintGoal"
          hint={es.planning.sprintGoalHint}
          value={goal}
          disabled={closed}
          onChange={(e) => {
            setGoal(e.target.value);
            setDirty(true);
          }}
          error={failure?.fields.sprintGoal}
        />

        <fieldset className="mb-4 rounded-md border border-[var(--color-border)] p-3" disabled={closed}>
          <legend className="px-1 text-sm font-medium">{es.planning.items}</legend>
          <p className="mb-2 text-sm text-[var(--color-muted)]">{es.planning.itemsHint}</p>
          {backlog.length === 0 ? <p className="text-sm">{es.planning.noItems}</p> : null}
          <ul className="space-y-1">
            {backlog.map((item) => (
              <li key={item.id}>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                  <span className="font-mono text-sm">{item.code}</span>
                  <span>{item.title}</span>
                  <GateStateBadge state={item.gateState} />
                </label>
              </li>
            ))}
          </ul>
          {failure?.fields.itemIds ? (
            <p role="alert" className="mt-1 text-sm font-medium text-[var(--color-danger)]">
              <span aria-hidden="true">⚠ </span>
              {failure.fields.itemIds}
            </p>
          ) : null}
        </fieldset>

        <FormField
          multiline
          rows={5}
          label={es.planning.workPlan}
          name="workPlan"
          hint={es.planning.workPlanHint}
          value={plan}
          disabled={closed}
          onChange={(e) => {
            setPlan(e.target.value);
            setDirty(true);
          }}
          error={failure?.fields.workPlan}
        />

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy !== null || closed || !dirty}>
            {busy === 'save' ? es.common.saving : es.planning.save}
          </Button>
          <Button variant="secondary" disabled={busy !== null || dirty || closed} onClick={() => void onEvaluate()}>
            {busy === 'evaluate' ? es.planning.evaluating : es.planning.evaluate}
          </Button>
          <RecommendButton artifact={{ artifactType: 'SPRINT', artifactId: sprint.id, label: `Planificación del Sprint ${sprint.number}` }} disabled={dirty} />
          <Button variant="secondary" disabled={busy !== null || !canComplete || closed} onClick={() => void onComplete()}>
            {busy === 'complete' ? es.planning.completing : es.planning.complete}
          </Button>
          {showException ? (
            <Button variant="danger" onClick={() => setAskException(true)}>
              {es.planning.requestException}
            </Button>
          ) : null}
        </div>
        {dirty ? <p className="mt-2 text-sm text-[var(--color-muted)]">{es.planning.unsaved}</p> : null}
        {!dirty && !canComplete && !validated ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">{es.planning.needsEvaluation}</p>
        ) : null}
      </form>

      {askException && run ? (
        <ExceptionDialog
          projectId={project.id}
          validationId={run.id}
          onCancel={() => setAskException(false)}
          onGranted={() => {
            setAskException(false);
            setNotice(es.planning.exceptionGranted);
            reload();
            void api<ValidationRun>(`/projects/${project.id}/validations/${run.id}`).then(setRun);
          }}
        />
      ) : null}

      <TasksPanel projectId={project.id} sprintId={sprint.id} itemIds={sprint.itemIds} onChanged={reload} />

      {run ? <EvaluationSummary run={run} label={`Planificación del Sprint ${sprint.number}`} artifact={{ artifactType: 'SPRINT', artifactId: sprint.id, label: `Planificación del Sprint ${sprint.number}` }} /> : null}
      {run?.exception ? (
        <p className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-3 text-sm text-[var(--color-warning)]">
          <strong>Excepción:</strong> {run.exception.justification} ({run.exception.authorizedByPseudonym})
        </p>
      ) : null}
      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </section>
  );
}
