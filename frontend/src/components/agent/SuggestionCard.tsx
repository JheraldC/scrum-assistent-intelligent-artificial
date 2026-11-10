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
  /** Dentro de una recomendación por campo: el nombre del campo ya se ve arriba, así que no se repite. */
  embedded?: boolean;
}

type Mode = 'idle' | 'confirm' | 'edit';

const shown = (v: string | string[]) => {
  const text = Array.isArray(v) ? v.map((x) => `• ${x}`).join('\n') : v;
  return text.trim() === '' ? es.panel.empty : text;
};

const selectClass = 'mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm';

/**
 * Propuesta de la IA para revisar. Nada cambia hasta que una persona la confirma: «Aceptar» muestra el
 * efecto y pide confirmación; «Editar» permite ajustar el valor antes. Los textos de la IA se pintan
 * siempre como texto plano.
 */
export function SuggestionCard({ projectId, suggestion, onResolved, embedded }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const change = suggestion.change;
  const [title, setTitle] = useState(suggestion.title);
  const [asA, setAsA] = useState(suggestion.asA ?? '');
  const [iWant, setIWant] = useState(suggestion.iWant ?? '');
  const [soThat, setSoThat] = useState(suggestion.soThat ?? '');
  const [criteria, setCriteria] = useState(suggestion.acceptanceCriteria.join('\n'));
  const [value, setValue] = useState(change ? (Array.isArray(change.proposedValue) ? change.proposedValue.join('\n') : change.proposedValue) : '');
  const [itemId, setItemId] = useState(suggestion.itemId ?? '');
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
    <li data-suggestion={suggestion.id} data-kind={kind} className={`text-sm text-[var(--color-text)] ${embedded ? '' : 'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2'}`}>
      {kind === 'FIELD_CHANGE' && change ? (
        <div data-field-change={change.field}>
          {embedded ? null : (
            <p className="text-xs text-[var(--color-muted)]">
              {change.fieldLabel} · {change.artifactLabel}
            </p>
          )}
          <div className="mt-1 grid gap-1">
            <p className="rounded border border-[var(--color-border)] px-2 py-1 whitespace-pre-wrap">
              <span className="block text-xs font-medium">{es.panel.current}</span>
              {shown(change.currentValue)}
            </p>
            <p className="rounded bg-[var(--color-success-bg)] px-2 py-1 whitespace-pre-wrap">
              <span className="block text-xs font-medium">{es.panel.proposedValue}</span>
              {shown(change.proposedValue)}
            </p>
          </div>
          {change.rationale ? <p className="mt-1 text-xs text-[var(--color-muted)]">{change.rationale}</p> : null}
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-[var(--color-ai)]">
            {es.panel.kinds[kind]}
            {suggestion.itemCode ? <span className="font-mono"> · {suggestion.itemCode}</span> : null}
          </p>
          {suggestion.title && suggestion.title !== suggestion.text ? <p className="font-medium">{suggestion.title}</p> : null}
          <p className="whitespace-pre-wrap">{suggestion.text}</p>
          {kind === 'STORY' && suggestion.iWant ? (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {suggestion.asA ? `Como ${suggestion.asA}, ` : ''}quiero {suggestion.iWant}
              {suggestion.soThat ? `, para ${suggestion.soThat}` : ''}
            </p>
          ) : null}
          {suggestion.acceptanceCriteria.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {suggestion.acceptanceCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {suggestion.basis === 'DOCUMENTO' ? suggestion.sources.map((s) => `«${s.document}»${s.section ? `, ${s.section}` : ''}`).join('; ') : es.panel.basisInference}
          </p>
        </>
      )}

      {mode === 'edit' ? (
        <div className="mt-2">
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
        <div className="mt-2">
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

      {mode !== 'idle' ? (
        <p className="mt-2 rounded bg-[var(--color-info-bg)] p-2 text-xs text-[var(--color-info)]">
          {suggestion.effect} {es.panel.confirmText}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 rounded border border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-2 text-xs font-medium text-[var(--color-danger)]">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {mode === 'idle' ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => void (suggestion.actionable ? openMode('confirm') : resolve('ACCEPT'))}>
              {suggestion.actionable ? es.panel.accept : es.panel.markReviewed}
            </Button>
            {suggestion.actionable ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void openMode('edit')}>
                {es.panel.edit}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void resolve('DISCARD')}>
              {es.panel.discard}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" disabled={busy || (needsItem && !itemId)} onClick={() => void resolve('ACCEPT')}>
              {es.panel.confirm}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMode('idle')}>
              {es.panel.cancel}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
