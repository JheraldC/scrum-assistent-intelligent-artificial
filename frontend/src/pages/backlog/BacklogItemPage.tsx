import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { BacklogItem, ValidationRun } from '../../api/types';
import { useCatalogTitles } from '../../api/useCatalogTitles';
import { useAssistantFocus } from '../../components/agent/AssistantContext';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Toast } from '../../components/ui/Toast';
import { VersionConflictDialog } from '../../components/ui/VersionConflictDialog';
import { GateResultPanel } from '../../components/validation/GateResultPanel';
import { GateStateBadge } from '../../components/validation/GateStateBadge';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';

interface FormValues {
  kind: 'USER_STORY' | 'ITEM';
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  description: string;
  criteria: string;
  priority: string;
}

const empty = (kind: 'USER_STORY' | 'ITEM', priority: number): FormValues => ({
  kind,
  title: '',
  asA: '',
  iWant: '',
  soThat: '',
  description: '',
  criteria: '',
  priority: String(priority),
});

const fromItem = (item: BacklogItem): FormValues => ({
  kind: item.kind,
  title: item.title,
  asA: item.asA ?? '',
  iWant: item.iWant ?? '',
  soThat: item.soThat ?? '',
  description: item.description ?? '',
  criteria: item.acceptanceCriteria.join('\n'),
  priority: String(item.priority),
});

const toBody = (v: FormValues) => ({
  kind: v.kind,
  title: v.title,
  ...(v.kind === 'USER_STORY' ? { asA: v.asA, iWant: v.iWant, soThat: v.soThat } : { description: v.description }),
  acceptanceCriteria: v.criteria.split('\n').map((c) => c.trim()).filter(Boolean),
  priority: Number(v.priority),
});

/** Crear (`/backlog/nuevo`) o editar (`/backlog/:itemId`) un elemento y evaluarlo con reglas (FR-008–FR-010). */
export function BacklogItemPage() {
  const { project } = useProject();
  const { itemId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const titles = useCatalogTitles();
  const creating = !itemId;
  const base = `/proyectos/${project.id}/backlog`;

  const [item, setItem] = useState<BacklogItem | null>(null);
  const [values, setValues] = useState<FormValues>(empty(search.get('tipo') === 'ITEM' ? 'ITEM' : 'USER_STORY', 1));
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(!creating);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [conflict, setConflict] = useState<BacklogItem | null>(null);
  const [saved, setSaved] = useState(false);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  useAssistantFocus(item ? { targetType: 'BACKLOG_ITEM', targetId: item.id, label: `${item.code} · ${item.title}` } : null);

  function load(next: BacklogItem) {
    setItem(next);
    setValues(fromItem(next));
    setDirty(false);
  }

  useEffect(() => {
    if (creating) {
      api<BacklogItem[]>(`/projects/${project.id}/backlog`)
        .then((list) => setValues((v) => ({ ...v, priority: String(list.length + 1) })))
        .catch(() => undefined);
      return;
    }
    api<BacklogItem>(`/projects/${project.id}/backlog/${itemId}`)
      .then(load)
      .catch((error: unknown) => setFailure(toFormFailure(error)))
      .finally(() => setLoading(false));
  }, [creating, itemId, project.id]);

  const set = <K extends keyof FormValues>(key: K) => (value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    setConflict(null);
    try {
      if (creating) {
        const created = await api<BacklogItem>(`/projects/${project.id}/backlog`, { method: 'POST', body: toBody(values) });
        navigate(`${base}/${created.id}`, { replace: true });
      } else {
        const updated = await api<BacklogItem>(`/projects/${project.id}/backlog/${itemId}`, {
          method: 'PATCH',
          body: { ...toBody(values), expectedVersion: item!.version },
        });
        load(updated);
        setSaved(true);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') setConflict(error.current as BacklogItem);
      else setFailure(toFormFailure(error));
    } finally {
      setBusy(false);
    }
  }

  async function evaluate() {
    if (!item) return;
    setEvaluating(true);
    setFailure(null);
    try {
      const result = await api<ValidationRun>(`/projects/${project.id}/validations`, {
        method: 'POST',
        body: { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: item.id },
      });
      setRun(result);
      setItem(await api<BacklogItem>(`/projects/${project.id}/backlog/${item.id}`));
    } catch (error) {
      setFailure(toFormFailure(error));
    } finally {
      setEvaluating(false);
    }
  }

  if (loading) return <LoadingSkeleton />;
  const isStory = values.kind === 'USER_STORY';
  const f = es.backlog.fields;

  return (
    <section className="max-w-3xl">
      <h2 className="mb-1 text-xl font-semibold">
        {creating ? (isStory ? es.backlog.newStory : es.backlog.newItem) : `${item?.code} · ${es.backlog.kind[values.kind]}`}
      </h2>
      {item ? (
        <p className="mb-3">
          <GateStateBadge state={item.gateState} />
        </p>
      ) : null}
      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}
      {conflict ? (
        <VersionConflictDialog
          title={es.backlog.conflictTitle}
          body={es.backlog.conflictBody}
          reloadLabel={es.backlog.conflictReload}
          keepLabel={es.backlog.conflictKeep}
          onReload={() => {
            load(conflict);
            setConflict(null);
          }}
          onKeep={() => {
            // Se conserva el texto escrito y se adopta la versión actual para poder guardar de nuevo.
            setItem(conflict);
            setConflict(null);
          }}
        />
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <FormField label={f.title} name="title" required value={values.title} onChange={(e) => set('title')(e.target.value)} error={failure?.fields.title} />
        {isStory ? (
          <>
            <FormField label={f.asA} name="asA" hint={es.backlog.hints.asA} value={values.asA} onChange={(e) => set('asA')(e.target.value)} error={failure?.fields.asA} />
            <FormField multiline rows={2} label={f.iWant} name="iWant" hint={es.backlog.hints.iWant} value={values.iWant} onChange={(e) => set('iWant')(e.target.value)} error={failure?.fields.iWant} />
            <FormField multiline rows={2} label={f.soThat} name="soThat" hint={es.backlog.hints.soThat} value={values.soThat} onChange={(e) => set('soThat')(e.target.value)} error={failure?.fields.soThat} />
          </>
        ) : (
          <FormField multiline rows={3} label={f.description} name="description" value={values.description} onChange={(e) => set('description')(e.target.value)} error={failure?.fields.description} />
        )}
        <FormField
          multiline
          rows={4}
          label={f.acceptanceCriteria}
          name="criteria"
          hint={es.backlog.hints.acceptanceCriteria}
          value={values.criteria}
          onChange={(e) => set('criteria')(e.target.value)}
          error={failure?.fields.acceptanceCriteria}
        />
        <FormField
          label={f.priority}
          name="priority"
          type="number"
          min={1}
          hint={es.backlog.hints.priority}
          value={values.priority}
          onChange={(e) => set('priority')(e.target.value)}
          error={failure?.fields.priority}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? es.common.saving : es.common.save}
          </Button>
          {!creating ? (
            <Button variant="secondary" disabled={evaluating || dirty} onClick={() => void evaluate()}>
              {evaluating ? es.backlog.evaluating : es.backlog.evaluate}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => navigate(base)}>
            {es.common.cancel}
          </Button>
        </div>
        {!creating && dirty ? <p className="mt-2 text-sm text-[var(--color-muted)]">Guarde los cambios antes de evaluar.</p> : null}
      </form>

      {run ? <GateResultPanel run={run} titles={titles} projectId={project.id} onRunUpdated={setRun} /> : null}
      {saved ? <Toast message={es.backlog.saved} onClose={() => setSaved(false)} /> : null}
    </section>
  );
}
