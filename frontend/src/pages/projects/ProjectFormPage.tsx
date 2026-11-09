import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { Project } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Toast } from '../../components/ui/Toast';
import { es } from '../../i18n/es';

/** Crear (`/proyectos/nuevo`) o configurar (`/proyectos/:projectId/ajustes`) un proyecto. */
export function ProjectFormPage() {
  const { projectId } = useParams();
  const editing = Boolean(projectId);
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', description: '', productGoal: '' });
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [conflict, setConflict] = useState<Project | null>(null);
  const [saved, setSaved] = useState(false);

  function apply(project: Project) {
    setValues({ name: project.name, description: project.description, productGoal: project.productGoal });
    setVersion(project.version);
  }

  useEffect(() => {
    if (!projectId) return;
    api<Project>(`/projects/${projectId}`)
      .then(apply)
      .catch((error: unknown) => setFailure(toFormFailure(error)))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    setConflict(null);
    try {
      if (editing) {
        const updated = await api<Project>(`/projects/${projectId}`, {
          method: 'PATCH',
          body: { ...values, expectedVersion: version },
        });
        apply(updated);
        setSaved(true);
      } else {
        const created = await api<Project>('/projects', { method: 'POST', body: values });
        navigate(`/proyectos/${created.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') setConflict(error.current as Project);
      else setFailure(toFormFailure(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold">{editing ? es.projects.settingsTitle : es.projects.createTitle}</h1>
      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}
      {conflict ? (
        <div role="alert" className="my-4 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4 text-[var(--color-warning)]">
          <p className="font-medium">
            <span aria-hidden="true">⚠ </span>
            {es.projects.conflictTitle}
          </p>
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => {
              apply(conflict);
              setConflict(null);
            }}
          >
            {es.projects.conflictReload}
          </Button>
        </div>
      ) : null}
      <form onSubmit={onSubmit} noValidate>
        <FormField
          label={es.projects.name}
          name="name"
          required
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          error={failure?.fields.name}
        />
        <FormField
          multiline
          rows={3}
          label={es.projects.description}
          name="description"
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          error={failure?.fields.description}
        />
        <FormField
          multiline
          rows={3}
          label={es.projects.productGoal}
          name="productGoal"
          required
          hint={es.projects.productGoalHint}
          value={values.productGoal}
          onChange={(e) => setValues({ ...values, productGoal: e.target.value })}
          error={failure?.fields.productGoal}
        />
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? es.common.saving : es.common.save}
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            {es.common.cancel}
          </Button>
        </div>
      </form>
      {saved ? <Toast message={es.projects.saved} onClose={() => setSaved(false)} /> : null}
    </section>
  );
}
