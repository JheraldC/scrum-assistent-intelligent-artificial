import { useState } from 'react';
import { api, ApiError } from '../../api/client';
import type { BacklogItem, ResolvedSuggestion, Suggestion } from '../../api/types';
import { es } from '../../i18n/es';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';

interface Props {
  projectId: string;
  suggestion: Suggestion;
  /** Se llama cuando la propuesta se aceptó o descartó (la pantalla recarga el proyecto). */
  onResolved: (result: ResolvedSuggestion) => void;
}

type Mode = 'idle' | 'confirm' | 'edit';

const shown = (v: string | string[]) => {
  const text = Array.isArray(v) ? v.map((x) => `• ${x}`).join('\n') : v;
  return text.trim() === '' ? es.panel.empty : text;
};

const selectClass = 'mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base';

/**
 * Propuesta de la IA para revisar. Nada cambia hasta que una persona la confirma; antes se muestra
 * el cambio y su efecto, y se puede editar. Los textos de la IA se pintan siempre como texto plano.
 */
export function SuggestionCard({ projectId, suggestion, onResolved }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [title, setTitle] = useState(suggestion.title);
  const [asA, setAsA] = useState(suggestion.asA ?? '');
  const [iWant, setIWant] = useState(suggestion.iWant ?? '');
  const [soThat, setSoThat] = useState(suggestion.soThat ?? '');
  const [criteria, setCriteria] = useState(suggestion.acceptanceCriteria.join('\n'));
  const [itemId, setItemId] = useState(suggestion.itemId ?? '');
  const change = suggestion.change;
  const [value, setValue] = useState(change ? (Array.isArray(change.proposedValue) ? change.proposedValue.join('\n') : change.proposedValue) : '');
  const [items, setItems] = useState<BacklogItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = suggestion.kind;
  const needsItem = kind === 'ACCEPTANCE_CRITERIA';

  async function openMode(next: Mode) {
    setError(null);
    setMode(next);
    if (needsItem && !items) {
      try {
        setItems(await api<BacklogItem[]>(`/projects/${projectId}/backlog`));
      } catch {
        setItems([]);
      }
    }
  }

  function buildEdit() {
    const lines = criteria.split('\n').map((l) => l.trim()).filter(Boolean);
    return {
      ...(kind === 'STORY' || kind === 'TASK' ? { title } : {}),
      ...(kind === 'STORY' ? { asA, iWant, soThat } : {}),
      ...(kind === 'STORY' || kind === 'ACCEPTANCE_CRITERIA' ? { acceptanceCriteria: lines } : {}),
      ...(needsItem && itemId ? { itemId } : {}),
      ...(kind === 'FIELD_CHANGE' && change ? { value: change.fieldKind === 'list' ? value.split('\n').map((l) => l.trim()).filter(Boolean) : value.trim() } : {}),
    };
  }

  async function resolve(action: 'ACCEPT' | 'DISCARD') {
    setBusy(true);
    setError(null);
    try {
      const result = await api<ResolvedSuggestion>(`/projects/${projectId}/agent/suggestions/${suggestion.id}/resolve`, {
        method: 'POST',
        body: action === 'ACCEPT' ? { action, confirm: true, edit: mode === 'edit' ? buildEdit() : needsItem && itemId ? { itemId } : undefined } : { action },
      });
      onResolved(result);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') setError(es.panel.conflict);
      else setError(err instanceof Error ? err.message : es.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li data-suggestion={suggestion.id} data-kind={kind} className="rounded-md border border-[var(--color-ai)] bg-[var(--color-ai-bg)] p-2 text-sm text-[var(--color-ai)]">
      {kind === 'FIELD_CHANGE' && change ? (
        <div data-field-change={change.field}>
          <p className="font-semibold">
            {change.fieldLabel} <span className="font-normal text-xs">· {change.artifactLabel}</span>
          </p>
          <div className="mt-1 grid gap-2 text-[var(--color-text)]">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              <p className="text-xs font-medium">{es.panel.current}</p>
              <p className="whitespace-pre-wrap">{shown(change.currentValue)}</p>
            </div>
            <div className="rounded-md border border-[var(--color-ai)] bg-[var(--color-surface)] p-2">
              <p className="text-xs font-medium">{es.panel.proposedValue}</p>
              <p className="whitespace-pre-wrap">{shown(change.proposedValue)}</p>
            </div>
          </div>
          {change.rationale ? <p className="mt-1 text-xs">{change.rationale}</p> : null}
        </div>
      ) : (
      <p className="font-semibold">
        {es.panel.kinds[kind]}
        {suggestion.itemCode ? <span className="font-mono"> · {suggestion.itemCode}</span> : null}
      </p>
      )}
      {kind !== 'FIELD_CHANGE' && suggestion.title && suggestion.title !== suggestion.text ? <p className="font-medium">{suggestion.title}</p> : null}
      {kind !== 'FIELD_CHANGE' ? <p className="whitespace-pre-wrap">{suggestion.text}</p> : null}
      {kind === 'STORY' ? (
        <p className="mt-1 text-xs">
          {suggestion.asA ? `Como ${suggestion.asA}, ` : ''}
          {suggestion.iWant ? `quiero ${suggestion.iWant}` : ''}
          {suggestion.soThat ? `, para ${suggestion.soThat}` : ''}
        </p>
      ) : null}
      {kind !== 'FIELD_CHANGE' && suggestion.acceptanceCriteria.length > 0 ? (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {suggestion.acceptanceCriteria.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-xs" hidden={kind === 'FIELD_CHANGE'}>
        <strong>{es.panel.sources}:</strong>{' '}
        {suggestion.basis === 'DOCUMENTO'
          ? suggestion.sources.map((s) => `«${s.document}»${s.section ? `, ${s.section}` : ''}`).join('; ')
          : es.panel.basisInference}
      </p>

      {suggestion.actionable ? (
        <p className="mt-1 text-xs">
          <strong>{es.panel.effect}:</strong> {suggestion.effect}
        </p>
      ) : (
        <p className="mt-1 text-xs">{es.panel.informative}. {suggestion.effect}</p>
      )}

      {mode === 'edit' ? (
        <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-text)]">
          {kind === 'FIELD_CHANGE' && change ? (
            <FormField
              multiline
              rows={change.fieldKind === 'list' ? 4 : 3}
              label={change.fieldKind === 'list' ? `${es.panel.fieldValue} · ${es.panel.fieldCriteria}` : es.panel.fieldValue}
              name={`v-${suggestion.id}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : null}
          {kind === 'STORY' || kind === 'TASK' ? <FormField label={es.panel.fieldTitle} name={`t-${suggestion.id}`} value={title} onChange={(e) => setTitle(e.target.value)} /> : null}
          {kind === 'STORY' ? (
            <>
              <FormField label={es.panel.fieldAsA} name={`a-${suggestion.id}`} value={asA} onChange={(e) => setAsA(e.target.value)} />
              <FormField label={es.panel.fieldIWant} name={`i-${suggestion.id}`} value={iWant} onChange={(e) => setIWant(e.target.value)} />
              <FormField label={es.panel.fieldSoThat} name={`s-${suggestion.id}`} value={soThat} onChange={(e) => setSoThat(e.target.value)} />
            </>
          ) : null}
          {kind === 'STORY' || kind === 'ACCEPTANCE_CRITERIA' ? (
            <FormField multiline rows={3} label={es.panel.fieldCriteria} name={`c-${suggestion.id}`} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
          ) : null}
        </div>
      ) : null}

      {needsItem && mode !== 'idle' ? (
        <div className="mt-2 text-[var(--color-text)]">
          <label htmlFor={`dest-${suggestion.id}`} className="block text-xs font-medium">
            {es.panel.pickItem}
          </label>
          <select id={`dest-${suggestion.id}`} className={selectClass} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">{es.panel.chooseItem}</option>
            {(items ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} · {i.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {mode === 'confirm' || mode === 'edit' ? (
        <p className="mt-2 rounded-md bg-[var(--color-surface)] p-2 text-xs text-[var(--color-text)]">{es.panel.confirmText}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 rounded-md bg-[var(--color-warning-bg)] p-2 text-xs text-[var(--color-warning)]">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2 text-[var(--color-text)]">
        {mode === 'idle' ? (
          <>
            {suggestion.actionable ? (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => void openMode('confirm')}>
                  {es.panel.accept}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void openMode('edit')}>
                  {es.panel.edit}
                </Button>
              </>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => void openMode('confirm')}>
                {es.panel.markReviewed}
              </Button>
            )}
            <Button variant="secondary" disabled={busy} onClick={() => void resolve('DISCARD')}>
              {es.panel.discard}
            </Button>
          </>
        ) : (
          <>
            <Button disabled={busy || (needsItem && !itemId)} onClick={() => void resolve('ACCEPT')}>
              {es.panel.confirm}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setMode('idle')}>
              {es.panel.cancel}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
