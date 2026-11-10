import { useState, type FormEvent } from 'react';
import { TRACKING_KINDS } from '@scrum/shared';
import { api } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { TrackingEntry, TrackingKind } from '../../api/types';
import { useResource } from '../../api/useResource';
import { CeremonyHelp } from '../../components/team/CeremonyHelp';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Toast } from '../../components/ui/Toast';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

/** Seguimiento del Sprint: avances, impedimentos, observaciones y reunión diaria (FR-038). */
export function TrackingPage() {
  const { project, reload: reloadProject } = useProject();
  const sprint = project.openSprint;
  const url = sprint ? `/projects/${project.id}/sprints/${sprint.id}/tracking` : '';
  const { data, error, loading, reload } = useResource(
    (signal) => (url ? api<TrackingEntry[]>(url, { signal }) : Promise.resolve([] as TrackingEntry[])),
    [url],
  );
  const [kind, setKind] = useState<TrackingKind>('PROGRESS');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState<'add' | 'complete' | null>(null);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!sprint) return <EmptyState title={es.tracking.noSprint} />;
  if (loading && !data) return <LoadingSkeleton />;

  const planning = sprint.stages.find((s) => s.type === 'PLANNING');
  const tracking = sprint.stages.find((s) => s.type === 'TRACKING');
  const planningValidated = planning?.status === 'VALIDATED';
  const entries = data ?? [];
  const open = entries.filter((e) => e.kind === 'IMPEDIMENT' && !e.resolvedAt).length;

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setBusy('add');
    setFailure(null);
    try {
      await api(url, { method: 'POST', body: { kind, content } });
      setContent('');
      setNotice(es.tracking.added);
      reload();
      reloadProject();
    } catch (err) {
      setFailure(toFormFailure(err));
    } finally {
      setBusy(null);
    }
  }

  async function onResolve(entry: TrackingEntry) {
    setFailure(null);
    try {
      await api(`${url}/${entry.id}/resolve`, { method: 'POST' });
      reload();
    } catch (err) {
      setFailure(toFormFailure(err));
    }
  }

  async function onComplete() {
    setBusy('complete');
    setFailure(null);
    try {
      await api(`/projects/${project.id}/sprints/${sprint!.id}/stages/TRACKING/complete`, { method: 'POST' });
      setNotice(es.tracking.completed);
      reloadProject();
    } catch (err) {
      setFailure(toFormFailure(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="max-w-3xl">
      <h2 className="mb-1 text-xl font-semibold">
        {es.tracking.title} · {es.flow.sprintLabel} {sprint.number}
      </h2>
      <p className="mb-2 text-sm text-[var(--color-muted)]">{es.tracking.intro}</p>
      <CeremonyHelp ceremony="DAILY" />
      {!planningValidated ? <p className="mb-3 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-3">{es.tracking.needsPlanning}</p> : null}
      {error ? <ErrorBanner message={error.message} onRetry={reload} /> : null}
      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}

      <form onSubmit={onAdd} noValidate className="mb-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="mb-3">
          <label htmlFor="tipo-registro" className="block text-sm font-medium">
            {es.tracking.kind}
          </label>
          <select
            id="tipo-registro"
            className="mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:w-64"
            value={kind}
            onChange={(e) => setKind(e.target.value as TrackingKind)}
          >
            {TRACKING_KINDS.map((k) => (
              <option key={k} value={k}>
                {es.tracking.kinds[k]}
              </option>
            ))}
          </select>
        </div>
        <FormField
          multiline
          rows={3}
          label={es.tracking.content}
          name="contenido-seguimiento"
          hint={es.tracking.contentHint}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          error={failure?.fields.content}
        />
        <Button type="submit" disabled={busy !== null || !planningValidated}>
          {es.tracking.add}
        </Button>
      </form>

      {open > 0 ? <p className="mb-2 font-medium">{es.tracking.openImpediments(open)}</p> : null}
      {entries.length === 0 ? (
        <EmptyState title={es.tracking.empty} />
      ) : (
        <ul className="mb-6 space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3" data-kind={e.kind}>
              <p className="mb-1 text-sm text-[var(--color-muted)]">
                <strong className="text-[var(--color-text)]">{es.tracking.kinds[e.kind]}</strong> ·{' '}
                <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString('es')}</time> · {es.tracking.by}{' '}
                <span className="font-mono">{e.authorPseudonym}</span>
              </p>
              <p className="whitespace-pre-wrap">{e.content}</p>
              {e.kind === 'IMPEDIMENT' ? (
                e.resolvedAt ? (
                  <p className="mt-1 text-sm text-[var(--color-success)]">
                    ✓ {es.tracking.resolved} · {es.tracking.resolvedAt} {new Date(e.resolvedAt).toLocaleString('es')}
                  </p>
                ) : (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-sm text-[var(--color-warning)]">⚠ {es.tracking.pending}</span>
                    {sprint.status === 'OPEN' ? (
                      <Button variant="secondary" onClick={() => void onResolve(e)}>
                        {es.tracking.resolve}
                      </Button>
                    ) : null}
                  </div>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        disabled={busy !== null || !planningValidated || tracking?.status === 'VALIDATED' || tracking?.status === 'PENDING'}
        onClick={() => void onComplete()}
      >
        {busy === 'complete' ? es.tracking.completing : es.tracking.complete}
      </Button>
      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </section>
  );
}
