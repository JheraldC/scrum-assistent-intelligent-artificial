import { useEffect, useState, type FormEvent } from 'react';
import { RETRO_ACTION_STATUSES } from '@scrum/shared';
import { api, ApiError } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { Member, RetroAction, Retrospective, ValidationRun } from '../../api/types';
import { useCatalogTitles } from '../../api/useCatalogTitles';
import { useAssistantFocus } from '../../components/agent/AssistantContext';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Toast } from '../../components/ui/Toast';
import { VersionConflictDialog } from '../../components/ui/VersionConflictDialog';
import { ExceptionDialog } from '../../components/validation/ExceptionDialog';
import { GateResultPanel } from '../../components/validation/GateResultPanel';
import { GateStateBadge } from '../../components/validation/GateStateBadge';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

const toLines = (list: string[]) => list.join('\n');
const fromLines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const selectClass =
  'mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2';

interface ActionRowProps {
  action: RetroAction;
  members: Member[];
  /** En un Sprint cerrado (o del Sprint anterior) solo se actualiza el seguimiento. */
  followUpOnly: boolean;
  url: string;
  onSaved: () => void;
  onError: (failure: FormFailure) => void;
  onConflict: () => void;
}

/** Fila editable de una acción: contenido (si el Sprint está abierto) y seguimiento. */
function ActionRow({ action, members, followUpOnly, url, onSaved, onError, onConflict }: ActionRowProps) {
  const [description, setDescription] = useState(action.description);
  const [ownerId, setOwnerId] = useState(action.ownerId ?? '');
  const [forNext, setForNext] = useState(action.forNextSprint);
  const [status, setStatus] = useState(action.status);
  const [note, setNote] = useState(action.followUpNote);
  const [busy, setBusy] = useState(false);
  const id = action.id;

  async function save() {
    setBusy(true);
    try {
      await api(`${url}/${id}`, {
        method: 'PATCH',
        body: followUpOnly
          ? { status, followUpNote: note, expectedVersion: action.version }
          : {
              description,
              ownerId: ownerId || null,
              forNextSprint: forNext,
              status,
              followUpNote: note,
              expectedVersion: action.version,
            },
      });
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') onConflict();
      else onError(toFormFailure(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
      data-action={id}
    >
      {followUpOnly ? (
        <p className="mb-2 font-medium">
          {action.description}{' '}
          <span className="text-sm font-normal text-[var(--color-muted)]">
            ({action.ownerPseudonym ?? es.retro.noOwner})
          </span>
        </p>
      ) : (
        <>
          <FormField
            label={es.retro.actionDescription}
            name={`desc-${id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`owner-${id}`} className="block text-sm font-medium">
                {es.retro.owner}
              </label>
              <select
                id={`owner-${id}`}
                className={selectClass}
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                <option value="">{es.retro.noOwner}</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.pseudonym}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex min-h-11 items-center gap-2 self-end">
              <input type="checkbox" checked={forNext} onChange={(e) => setForNext(e.target.checked)} />
              {es.retro.forNextSprint}
            </label>
          </div>
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`status-${id}`} className="block text-sm font-medium">
            {es.retro.status}
          </label>
          <select
            id={`status-${id}`}
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as RetroAction['status'])}
          >
            {RETRO_ACTION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {es.retro.statuses[st]}
              </option>
            ))}
          </select>
        </div>
        <FormField
          label={es.retro.followUp}
          name={`note-${id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Button variant="secondary" disabled={busy} onClick={() => void save()}>
        {followUpOnly ? es.retro.updateFollowUp : es.retro.saveAction}
      </Button>
    </li>
  );
}

/** Retrospectiva: positivos, problemas, mejoras, acciones con responsable y seguimiento (FR-018, FR-019). */
export function RetrospectivePage() {
  const { project, reload: reloadProject } = useProject();
  const sprint = project.openSprint;
  const titles = useCatalogTitles();
  const isFacilitator = project.myRole === 'FACILITATOR';

  const [retro, setRetro] = useState<Retrospective | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [positives, setPositives] = useState('');
  const [problems, setProblems] = useState('');
  const [improvements, setImprovements] = useState('');
  const [dirty, setDirty] = useState(false);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [busy, setBusy] = useState<'save' | 'evaluate' | 'complete' | 'add' | null>(null);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [askException, setAskException] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newDesc, setNewDesc] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newForNext, setNewForNext] = useState(true);

  useAssistantFocus(
    sprint
      ? {
          targetType: 'RETROSPECTIVE',
          targetId: sprint.id,
          label: `Retrospectiva del Sprint ${sprint.number}`,
        }
      : null,
  );

  const url = sprint ? `/projects/${project.id}/sprints/${sprint.id}/retrospective` : '';

  async function load(keepText = false) {
    if (!sprint) return;
    const next = await api<Retrospective>(url);
    setRetro(next);
    if (!keepText) {
      setPositives(toLines(next.positives));
      setProblems(toLines(next.problems));
      setImprovements(toLines(next.improvements));
      setDirty(false);
    }
  }

  useEffect(() => {
    if (!sprint) {
      setLoading(false);
      return;
    }
    Promise.all([
      load(),
      api<Member[]>(`/projects/${project.id}/members`).then(setMembers),
      api<ValidationRun[]>(
        `/projects/${project.id}/validations?targetType=RETROSPECTIVE&targetId=${sprint.id}`,
      ).then((runs) => setRun(runs[0] ?? null)),
    ])
      .catch((error: unknown) => setFailure(toFormFailure(error)))
      .finally(() => setLoading(false));
  }, [sprint?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSkeleton />;
  if (!sprint) return <EmptyState title={es.retro.noSprint} />;
  if (!retro) return failure ? <ErrorBanner message={failure.message} /> : <LoadingSkeleton />;

  const gateState = retro.gateState;
  const canComplete = gateState === 'APROBADA' || gateState === 'APROBADA_CON_EXCEPCION';
  const showException = isFacilitator && run?.status === 'FAILED' && gateState === 'NO_APROBADA';

  async function guard<T>(
    kind: 'save' | 'evaluate' | 'complete' | 'add',
    action: () => Promise<T>,
  ): Promise<T | undefined> {
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

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const saved = await guard('save', () =>
      api<Retrospective>(url, {
        method: 'PUT',
        body: {
          positives: fromLines(positives),
          problems: fromLines(problems),
          improvements: fromLines(improvements),
          expectedVersion: retro!.version,
        },
      }),
    );
    if (saved) {
      setRetro(saved);
      setDirty(false);
      setNotice(es.retro.saved);
      reloadProject();
    }
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const created = await guard('add', () =>
      api(`${url}/actions`, {
        method: 'POST',
        body: { description: newDesc, ownerId: newOwner || null, forNextSprint: newForNext },
      }),
    );
    if (created) {
      setNewDesc('');
      setNotice(es.retro.actionSaved);
      await load(true);
      reloadProject();
    }
  }

  async function onEvaluate() {
    const result = await guard('evaluate', () =>
      api<ValidationRun>(`/projects/${project.id}/validations`, {
        method: 'POST',
        body: { gateId: 'GATE-RETRO', targetType: 'RETROSPECTIVE', targetId: sprint!.id },
      }),
    );
    if (result) {
      setRun(result);
      setAskException(false);
      await load(true);
      reloadProject();
    }
  }

  async function onComplete() {
    const done = await guard('complete', () =>
      api(`/projects/${project.id}/sprints/${sprint!.id}/stages/RETROSPECTIVE/complete`, { method: 'POST' }),
    );
    if (done) {
      setNotice(es.retro.closed);
      reloadProject();
    }
  }

  const rowProps = (followUpOnly: boolean, base: string) => ({
    members,
    followUpOnly,
    url: base,
    onSaved: () => {
      setNotice(es.retro.actionSaved);
      void load(true);
      reloadProject();
    },
    onError: setFailure,
    onConflict: () => setConflict(true),
  });

  return (
    <section className="max-w-3xl">
      <h2 className="mb-1 text-xl font-semibold">
        {es.retro.title} · {es.flow.sprintLabel} {sprint.number}
      </h2>
      <p className="mb-2 text-sm text-[var(--color-muted)]">{es.retro.intro}</p>
      <p className="mb-2">
        <GateStateBadge state={gateState} />
      </p>
      <p className="mb-4 text-sm text-[var(--color-muted)]">{es.retro.gateBlocks}</p>

      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}
      {conflict ? (
        <VersionConflictDialog
          title={es.retro.conflictTitle}
          body={es.retro.conflictBody}
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
        <FormField
          multiline
          rows={3}
          label={es.retro.positives}
          name="positives"
          hint={es.retro.listHint}
          value={positives}
          onChange={(e) => {
            setPositives(e.target.value);
            setDirty(true);
          }}
        />
        <FormField
          multiline
          rows={3}
          label={es.retro.problems}
          name="problems"
          hint={es.retro.listHint}
          value={problems}
          onChange={(e) => {
            setProblems(e.target.value);
            setDirty(true);
          }}
        />
        <FormField
          multiline
          rows={3}
          label={es.retro.improvements}
          name="improvements"
          hint={es.retro.listHint}
          value={improvements}
          onChange={(e) => {
            setImprovements(e.target.value);
            setDirty(true);
          }}
        />
        <Button type="submit" disabled={busy !== null || !dirty}>
          {busy === 'save' ? es.common.saving : es.retro.save}
        </Button>
      </form>

      <h3 className="mb-2 mt-6 text-lg font-semibold">{es.retro.actions}</h3>
      {retro.actions.length === 0 ? (
        <p className="mb-3 text-sm text-[var(--color-muted)]">{es.retro.noActions}</p>
      ) : null}
      <ul className="mb-4 space-y-3">
        {retro.actions.map((a) => (
          <ActionRow key={`${a.id}-${a.version}`} action={a} {...rowProps(false, `${url}/actions`)} />
        ))}
      </ul>

      <form
        onSubmit={onAdd}
        noValidate
        className="mb-6 rounded-md border border-dashed border-[var(--color-border)] p-3"
      >
        <h4 className="mb-2 font-medium">{es.retro.newAction}</h4>
        <FormField
          label={es.retro.actionDescription}
          name="nueva-accion"
          hint={es.retro.actionHint}
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          error={failure?.fields.description}
        />
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nuevo-responsable" className="block text-sm font-medium">
              {es.retro.owner}
            </label>
            <select
              id="nuevo-responsable"
              className={selectClass}
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
            >
              <option value="">{es.retro.noOwner}</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.pseudonym}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 self-end">
            <input type="checkbox" checked={newForNext} onChange={(e) => setNewForNext(e.target.checked)} />
            {es.retro.forNextSprint}
          </label>
        </div>
        <Button type="submit" variant="secondary" disabled={busy !== null}>
          {es.retro.newAction}
        </Button>
      </form>

      {retro.previousSprint && retro.previousActions.length > 0 ? (
        <section className="mb-6">
          <h3 className="mb-1 text-lg font-semibold">
            {es.retro.previous} (Sprint {retro.previousSprint.number})
          </h3>
          <p className="mb-2 text-sm text-[var(--color-muted)]">{es.retro.previousHelp}</p>
          <ul className="space-y-3">
            {retro.previousActions.map((a) => (
              <ActionRow
                key={`${a.id}-${a.version}`}
                action={a}
                {...rowProps(
                  true,
                  `/projects/${project.id}/sprints/${retro.previousSprint!.id}/retrospective/actions`,
                )}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy !== null || dirty} onClick={() => void onEvaluate()}>
          {busy === 'evaluate' ? es.retro.evaluating : es.retro.evaluate}
        </Button>
        <Button
          variant="secondary"
          disabled={busy !== null || !canComplete}
          onClick={() => void onComplete()}
        >
          {busy === 'complete' ? es.retro.completing : es.retro.complete}
        </Button>
        {showException ? (
          <Button variant="danger" onClick={() => setAskException(true)}>
            {es.planning.requestException}
          </Button>
        ) : null}
      </div>
      {dirty ? <p className="mt-2 text-sm text-[var(--color-muted)]">{es.retro.unsaved}</p> : null}

      {askException && run ? (
        <ExceptionDialog
          projectId={project.id}
          validationId={run.id}
          onCancel={() => setAskException(false)}
          onGranted={() => {
            setAskException(false);
            setNotice(es.planning.exceptionGranted);
            void load(true);
            reloadProject();
            void api<ValidationRun>(`/projects/${project.id}/validations/${run.id}`).then(setRun);
          }}
        />
      ) : null}

      {run ? (
        <GateResultPanel run={run} titles={titles} projectId={project.id} onRunUpdated={setRun} />
      ) : null}
      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </section>
  );
}
