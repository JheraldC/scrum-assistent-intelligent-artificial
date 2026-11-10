import { useState, type FormEvent } from 'react';
import type { StageType } from '@scrum/shared';
import { api, downloadFile } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { Evidence } from '../../api/types';
import { useResource } from '../../api/useResource';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { Toast } from '../../components/ui/Toast';
import { es } from '../../i18n/es';

interface Props {
  projectId: string;
  sprintId: string;
  stageType: StageType;
  closed: boolean;
  onChanged: () => void;
}

/** Evidencia de una etapa (FR-006): listar y registrar texto o enlaces. */
export function EvidenceBox({ projectId, sprintId, stageType, closed, onChanged }: Props) {
  const url = `/projects/${projectId}/sprints/${sprintId}/stages/${stageType}/evidence`;
  const { data, error, reload } = useResource((signal) => api<Evidence[]>(url, { signal }), [url]);
  const [content, setContent] = useState('');
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    try {
      await api(url, { method: 'POST', body: { content } });
      setContent('');
      setSaved(true);
      reload();
      onChanged(); // la etapa pudo pasar a "En progreso"
    } catch (err) {
      setFailure(toFormFailure(err));
    }
  }

  return (
    <div>
      <h4 className="font-medium">{es.flow.evidence}</h4>
      {error ? <ErrorBanner message={error.message} onRetry={reload} /> : null}
      {data && data.length === 0 ? <p className="text-sm text-[var(--color-muted)]">{es.flow.noEvidence}</p> : null}
      {data && data.length > 0 ? (
        <ul className="my-2 list-disc space-y-1 pl-5 text-sm">
          {data.map((item) => (
            <li key={item.id}>
              {item.content}{' '}
              <span className="text-[var(--color-muted)]">
                ({item.authorPseudonym} · {new Date(item.createdAt).toLocaleString('es')} · {es.flow.stages[item.stageType as keyof typeof es.flow.stages]?.name ?? item.stageType})
              </span>
              {item.attachment ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void downloadFile(`${url}/${item.id}/file`).catch((e: unknown) => setFailure(toFormFailure(e)))}
                  >
                    {es.flow.attachment}: {item.attachment.fileName}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!closed ? (
        <form onSubmit={onSubmit} noValidate className="mt-2">
          <FormField
            multiline
            rows={2}
            label={es.flow.addEvidence}
            name={`evidencia-${stageType}`}
            hint={es.flow.evidenceHint}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            error={failure?.message}
          />
          <Button type="submit" variant="secondary">
            {es.flow.addEvidence}
          </Button>
        </form>
      ) : null}
      {saved ? <Toast message={es.flow.evidenceAdded} onClose={() => setSaved(false)} /> : null}
    </div>
  );
}
