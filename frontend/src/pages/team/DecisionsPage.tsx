import { useState, type FormEvent } from 'react';
import { DECISION_KINDS } from '@scrum/shared';
import { api } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { Decision } from '../../api/types';
import { useResource } from '../../api/useResource';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Toast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

/** Registro sencillo de decisiones y acuerdos del proyecto (solo se añaden; no se editan). */
export function DecisionsPage() {
  const { project } = useProject();
  const url = `/projects/${project.id}/decisions`;
  const { data, error, loading, reload } = useResource((signal) => api<Decision[]>(url, { signal }), [url]);
  const [kind, setKind] = useState<'DECISION' | 'AGREEMENT'>('DECISION');
  const [text, setText] = useState('');
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    try {
      await api(url, { method: 'POST', body: { kind, text } });
      setText('');
      setNotice(es.decisions.added);
      reload();
    } catch (err) {
      setFailure(toFormFailure(err));
    }
  }

  return (
    <section className="max-w-3xl">
      <PageHeader title={es.decisions.title} info={es.decisions.intro} />
      {error ? <ErrorBanner message={error.message} onRetry={reload} /> : null}
      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}

      <form onSubmit={onAdd} noValidate className="mb-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="mb-3">
          <label htmlFor="tipo-decision" className="block text-sm font-medium">
            {es.decisions.kind}
          </label>
          <select
            id="tipo-decision"
            className="mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:w-64"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'DECISION' | 'AGREEMENT')}
          >
            {DECISION_KINDS.map((k) => (
              <option key={k} value={k}>
                {es.decisions.kinds[k]}
              </option>
            ))}
          </select>
        </div>
        <FormField multiline rows={3} label={es.decisions.text} name="texto-decision" required hint={es.decisions.textHint} value={text} onChange={(e) => setText(e.target.value)} error={failure?.fields.text} />
        <Button type="submit" disabled={text.trim() === ''}>
          {es.decisions.add}
        </Button>
      </form>

      {loading && !data ? <LoadingSkeleton /> : null}
      {data && data.length === 0 ? <EmptyState title={es.decisions.empty} /> : null}
      <ul className="space-y-2">
        {(data ?? []).map((d) => (
          <li key={d.id} data-decision={d.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
            <p className="mb-1 text-[var(--color-muted)]">
              <strong className="text-[var(--color-text)]">{es.decisions.kinds[d.kind]}</strong> · <time dateTime={d.createdAt}>{new Date(d.createdAt).toLocaleString('es')}</time> · {es.docs.by}{' '}
              <span className="font-mono">{d.authorPseudonym}</span>
            </p>
            <p className="whitespace-pre-wrap">{d.text}</p>
          </li>
        ))}
      </ul>
      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </section>
  );
}
