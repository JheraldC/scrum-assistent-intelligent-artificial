import { useEffect, useState, type FormEvent } from 'react';
import { GOAL_ASSESSMENTS } from '@scrum/shared';
import { api, ApiError } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { SprintReview, ValidationRun } from '../../api/types';
import { EvaluationSummary, RecommendButton } from '../../components/agent/AiActions';
import { useAssistant, useAssistantChanges, useAssistantFocus } from '../../components/agent/AssistantContext';
import { CeremonyHelp } from '../../components/team/CeremonyHelp';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Toast } from '../../components/ui/Toast';
import { VersionConflictDialog } from '../../components/ui/VersionConflictDialog';
import { GateStateBadge } from '../../components/validation/GateStateBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

type Assessment = SprintReview['goalAssessment'];

/** Sprint Review: resultados, incremento, retroalimentación y valoración del Sprint Goal (FR-039). */
export function ReviewPage() {
  const { project, reload: reloadProject } = useProject();
  const sprint = project.openSprint;
  const { reportEvaluation } = useAssistant();
  const changes = useAssistantChanges();

  const [review, setReview] = useState<SprintReview | null>(null);
  const [results, setResults] = useState('');
  const [increment, setIncrement] = useState('');
  const [feedback, setFeedback] = useState('');
  const [assessment, setAssessment] = useState<Assessment>(null);
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [busy, setBusy] = useState<'save' | 'evaluate' | 'complete' | null>(null);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useAssistantFocus(
    sprint ? { targetType: 'SPRINT_REVIEW', targetId: sprint.id, label: `Review del Sprint ${sprint.number}` } : null,
  );

  const url = sprint ? `/projects/${project.id}/sprints/${sprint.id}/review` : '';

  function fill(next: SprintReview) {
    setResults(next.results);
    setIncrement(next.increment);
    setFeedback(next.feedback);
    setAssessment(next.goalAssessment);
    setNote(next.goalAssessmentNote);
    setDirty(false);
  }

  async function load(keepText = false) {
    if (!sprint) return;
    const next = await api<SprintReview>(url);
    setReview(next);
    if (!keepText) fill(next);
  }

  useEffect(() => {
    if (!sprint) {
      setLoading(false);
      return;
    }
    Promise.all([
      load(),
      api<ValidationRun[]>(`/projects/${project.id}/validations?targetType=SPRINT_REVIEW&targetId=${sprint.id}`).then((runs) =>
        setRun(runs[0] ?? null),
      ),
    ])
      .catch((error: unknown) => setFailure(toFormFailure(error)))
      .finally(() => setLoading(false));
  }, [sprint?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tras aplicar una propuesta de la IA, el formulario muestra la versión guardada.
  useEffect(() => {
    if (changes > 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes]);

  if (loading) return <LoadingSkeleton />;
  if (!sprint) return <EmptyState title={es.review.noSprint} />;
  if (!review) return failure ? <ErrorBanner message={failure.message} /> : <LoadingSkeleton />;

  async function guard<T>(kind: 'save' | 'evaluate' | 'complete', action: () => Promise<T>): Promise<T | undefined> {
    setBusy(kind);
    setFailure(null);
    try {
      return await action();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') setConflict(true);
      else setFailure(toFormFailure(error));
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setDirty(true);
  };

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const saved = await guard('save', () =>
      api<SprintReview>(url, {
        method: 'PUT',
        body: { results, increment, feedback, goalAssessment: assessment, goalAssessmentNote: note, expectedVersion: review!.version },
      }),
    );
    if (saved) {
      setReview(saved);
      setDirty(false);
      setNotice(es.review.saved);
      reloadProject();
    }
  }

  async function onEvaluate() {
    const result = await guard('evaluate', () =>
      api<ValidationRun>(`/projects/${project.id}/validations`, {
        method: 'POST',
        body: { gateId: 'GATE-REVIEW', targetType: 'SPRINT_REVIEW', targetId: sprint!.id },
      }),
    );
    if (result) {
      setRun(result);
      reportEvaluation(result, `Review del Sprint ${sprint!.number}`, { artifactType: 'SPRINT_REVIEW', artifactId: sprint!.id, label: `Review del Sprint ${sprint!.number}` });
      await load(true);
      reloadProject();
    }
  }

  async function onComplete() {
    const done = await guard('complete', () =>
      api(`/projects/${project.id}/sprints/${sprint!.id}/stages/REVIEW/complete`, { method: 'POST' }),
    );
    if (done) {
      setNotice(es.review.completed);
      reloadProject();
    }
  }

  const reviewStage = sprint.stages.find((s) => s.type === 'REVIEW');

  return (
    <section className="max-w-3xl">
      <PageHeader title={`${es.review.title} · ${es.flow.sprintLabel} ${sprint.number}`} info={`${es.review.intro} ${es.review.gateInfo}`} />
      <CeremonyHelp ceremony="REVIEW" />
      <p className="mb-2">
        <GateStateBadge state={review.gateState} />
      </p>

      <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <h3 className="text-sm font-medium">{es.review.sprintGoal}</h3>
        <p>{review.sprintGoal.trim() !== '' ? review.sprintGoal : es.review.noGoal}</p>
      </div>

      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}
      {conflict ? (
        <VersionConflictDialog
          title={es.review.conflictTitle}
          body={es.review.conflictBody}
          reloadLabel={es.planning.conflictReload}
          keepLabel={es.planning.conflictKeep}
          onReload={() => {
            setConflict(false);
            void load();
          }}
          onKeep={() => {
            setConflict(false);
            void load(true);
          }}
        />
      ) : null}

      <form onSubmit={onSave} noValidate>
        <FormField multiline rows={4} label={es.review.results} name="resultados" value={results} onChange={(e) => edit(setResults)(e.target.value)} error={failure?.fields.results} />
        <FormField multiline rows={4} label={es.review.increment} name="incremento" value={increment} onChange={(e) => edit(setIncrement)(e.target.value)} error={failure?.fields.increment} />
        <FormField multiline rows={4} label={es.review.feedback} name="retroalimentacion" value={feedback} onChange={(e) => edit(setFeedback)(e.target.value)} error={failure?.fields.feedback} />
        <div className="mb-3">
          <label htmlFor="valoracion-objetivo" className="block text-sm font-medium">
            {es.review.goalAssessment}
          </label>
          <select
            id="valoracion-objetivo"
            className="mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:w-64"
            value={assessment ?? ''}
            onChange={(e) => {
              setAssessment((e.target.value || null) as Assessment);
              setDirty(true);
            }}
          >
            <option value="">{es.review.assessments['']}</option>
            {GOAL_ASSESSMENTS.map((g) => (
              <option key={g} value={g}>
                {es.review.assessments[g]}
              </option>
            ))}
          </select>
        </div>
        <FormField multiline rows={3} label={es.review.goalNote} name="explicacion-objetivo" value={note} onChange={(e) => edit(setNote)(e.target.value)} error={failure?.fields.goalAssessmentNote} />
        <Button type="submit" disabled={busy !== null || !dirty}>
          {busy === 'save' ? es.common.saving : es.review.save}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy !== null || dirty} onClick={() => void onEvaluate()}>
          {busy === 'evaluate' ? es.review.evaluating : es.review.evaluate}
        </Button>
        <RecommendButton artifact={{ artifactType: 'SPRINT_REVIEW', artifactId: sprint.id, label: `Review del Sprint ${sprint.number}` }} disabled={dirty} />
        <Button variant="secondary" disabled={busy !== null || dirty || reviewStage?.status === 'VALIDATED' || reviewStage?.status === 'PENDING'} onClick={() => void onComplete()}>
          {busy === 'complete' ? es.review.completing : es.review.complete}
        </Button>
      </div>
      {dirty ? <p className="mt-2 text-sm text-[var(--color-muted)]">{es.review.unsaved}</p> : null}

      {run ? <EvaluationSummary run={run} label={`Review del Sprint ${sprint.number}`} artifact={{ artifactType: 'SPRINT_REVIEW', artifactId: sprint.id, label: `Review del Sprint ${sprint.number}` }} /> : null}
      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </section>
  );
}
