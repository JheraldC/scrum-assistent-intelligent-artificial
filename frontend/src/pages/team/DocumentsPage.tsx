import { useRef, useState, type FormEvent } from 'react';
import { api, apiUpload, downloadFile } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { DocumentItem, DocumentVersion } from '../../api/types';
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

const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`);

function DocumentRow({ doc, projectId, canEdit, onChanged, onError }: { doc: DocumentItem; projectId: string; canEdit: boolean; onChanged: (message: string) => void; onError: (f: FormFailure) => void }) {
  const base = `/projects/${projectId}/documents/${doc.id}`;
  const replaceRef = useRef<HTMLInputElement>(null);
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null);

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      onChanged(message);
    } catch (error) {
      onError(toFormFailure(error));
    }
  };
  const patch = (body: object) => run(() => api(base, { method: 'PATCH', body }), es.docs.saved);

  return (
    <li data-document={doc.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
      <p className="font-medium">
        {doc.name}{' '}
        <span className={`ml-1 rounded px-2 py-0.5 text-xs ${doc.status === 'ACTIVE' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'}`}>
          <span aria-hidden="true">{doc.status === 'ACTIVE' ? '✓ ' : '⚠ '}</span>
          {doc.status === 'ACTIVE' ? es.docs.active : es.docs.outdated}
        </span>
      </p>
      <p className="text-[var(--color-muted)]">
        {es.docs.version} {doc.currentVersion} · {doc.current.fileName} · {kb(doc.current.sizeBytes)} · {new Date(doc.current.uploadedAt).toLocaleString('es')} · {es.docs.by}{' '}
        <span className="font-mono">{doc.current.uploadedByPseudonym}</span>
      </p>

      <label className="mt-2 flex min-h-11 items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={doc.includeInContext}
          disabled={!canEdit || !doc.current.usableAsContext}
          onChange={(e) => void patch({ includeInContext: e.target.checked })}
        />
        <span>
          {es.docs.useInContext}
          {!doc.current.usableAsContext ? <span className="block text-xs text-[var(--color-muted)]">{es.docs.notUsable}</span> : null}
        </span>
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void run(() => downloadFile(`${base}/file`), es.docs.download)}>
          {es.docs.download}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void api<DocumentVersion[]>(`${base}/versions`).then(setVersions).catch((e: unknown) => onError(toFormFailure(e)))}
        >
          {es.docs.versions}
        </Button>
        {canEdit ? (
          <>
            <Button variant="secondary" onClick={() => void patch({ status: doc.status === 'ACTIVE' ? 'OUTDATED' : 'ACTIVE' })}>
              {doc.status === 'ACTIVE' ? es.docs.markOutdated : es.docs.markActive}
            </Button>
            <Button variant="secondary" onClick={() => replaceRef.current?.click()}>
              {es.docs.replace}
            </Button>
            <input
              ref={replaceRef}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-label={`${es.docs.replace}: ${doc.name}`}
              accept=".md,.txt,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const form = new FormData();
                form.append('file', file);
                void run(() => apiUpload(`${base}/versions`, form), es.docs.replaced);
              }}
            />
          </>
        ) : null}
      </div>
      {versions ? (
        <ul className="mt-2 list-disc pl-5 text-xs">
          {versions.map((v) => (
            <li key={v.version}>
              {es.docs.version} {v.version}: {v.fileName} ({kb(v.sizeBytes)}) · {new Date(v.uploadedAt).toLocaleString('es')}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Documentación permanente del proyecto (opcional). No se mezcla con la evidencia de las etapas. */
export function DocumentsPage() {
  const { project } = useProject();
  const canEdit = project.myRole === 'FACILITATOR';
  const url = `/projects/${project.id}/documents`;
  const { data, error, loading, reload } = useResource((signal) => api<DocumentItem[]>(url, { signal }), [url]);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setFailure(null);
    try {
      const form = new FormData();
      if (name.trim()) form.append('name', name.trim());
      form.append('file', file);
      await apiUpload(url, form);
      setName('');
      setFile(null);
      setFileKey((k) => k + 1);
      setNotice(es.docs.uploaded);
      reload();
    } catch (err) {
      setFailure(toFormFailure(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-3xl">
      <PageHeader title={es.docs.title} info={`${es.docs.intro} ${es.docs.formats}`} />
      <p className="mb-4 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-3 text-sm text-[var(--color-warning)]">
        <span aria-hidden="true">⚠ </span>
        {es.docs.privacy}
      </p>
      {error ? <ErrorBanner message={error.message} onRetry={reload} /> : null}
      {failure ? <ErrorBanner message={failure.message} /> : null}

      {canEdit ? (
        <form onSubmit={onUpload} noValidate className="mb-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <h3 className="mb-2 font-semibold">{es.docs.upload}</h3>
          <FormField label={es.docs.name} name="nombre-documento" value={name} onChange={(e) => setName(e.target.value)} />
          <FormField key={fileKey} label={es.docs.file} name="archivo-documento" type="file" accept=".md,.txt,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button type="submit" disabled={busy || !file}>
            {es.docs.upload}
          </Button>
        </form>
      ) : (
        <p className="mb-4 text-sm text-[var(--color-muted)]">{es.docs.onlyFacilitator}</p>
      )}

      {loading && !data ? <LoadingSkeleton /> : null}
      {data && data.length === 0 ? <EmptyState title={es.docs.empty} /> : null}
      <ul className="space-y-3">
        {(data ?? []).map((doc) => (
          <DocumentRow
            key={`${doc.id}-${doc.currentVersion}-${doc.status}-${doc.includeInContext}`}
            doc={doc}
            projectId={project.id}
            canEdit={canEdit}
            onChanged={(message) => {
              setNotice(message);
              reload();
            }}
            onError={setFailure}
          />
        ))}
      </ul>
      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </section>
  );
}
