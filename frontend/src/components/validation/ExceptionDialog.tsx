import { useState, type FormEvent } from 'react';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import { api } from '../../api/client';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { FormField } from '../ui/FormField';
import { es } from '../../i18n/es';

interface Props {
  projectId: string;
  validationId: string;
  onGranted: () => void;
  onCancel: () => void;
}

/** Excepción manual de compuerta: solo el Facilitador; justificación obligatoria (FR-016). */
export function ExceptionDialog({ projectId, validationId, onGranted, onCancel }: Props) {
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await api(`/projects/${projectId}/validations/${validationId}/exception`, { method: 'POST', body: { justification } });
      onGranted();
    } catch (error) {
      setFailure(toFormFailure(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      role="group"
      aria-labelledby="excepcion-titulo"
      className="my-4 rounded-md border-2 border-[var(--color-warning)] bg-[var(--color-surface)] p-4"
    >
      <h3 id="excepcion-titulo" className="text-lg font-semibold">
        {es.planning.exceptionTitle}
      </h3>
      <p className="mb-3 text-sm text-[var(--color-muted)]">{es.planning.exceptionHelp}</p>
      {failure && !failure.fields.justification ? <ErrorBanner message={failure.message} /> : null}
      <form onSubmit={onSubmit} noValidate>
        <FormField
          multiline
          rows={3}
          label={es.planning.justification}
          name="justification"
          hint={es.planning.justificationHint}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          error={failure?.fields.justification}
        />
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {es.planning.grantException}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {es.common.cancel}
          </Button>
        </div>
      </form>
    </section>
  );
}
