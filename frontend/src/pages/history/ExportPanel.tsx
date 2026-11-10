import { useState } from 'react';
import { downloadFile } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Toast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { es } from '../../i18n/es';

const DATASETS = [
  'activities',
  'stage_durations',
  'validation_runs',
  'criterion_results',
  'exceptions',
  'agent_interactions',
] as const;

/** Exportación de datos del proyecto (FR-027): JSON completo o un conjunto en CSV. Solo el Facilitador. */
export function ExportPanel({ projectId }: { projectId: string }) {
  const [dataset, setDataset] = useState<(typeof DATASETS)[number]>('validation_runs');
  const [includeText, setIncludeText] = useState(false);
  const [includeSample, setIncludeSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run(format: 'json' | 'csv') {
    setBusy(true);
    setError(null);
    const query = new URLSearchParams({
      format,
      includeText: String(includeText),
      includeSample: String(includeSample),
    });
    if (format === 'csv') query.set('dataset', dataset);
    try {
      setDone(es.export.done(await downloadFile(`/projects/${projectId}/export?${query.toString()}`)));
    } catch (err) {
      setError(err instanceof Error ? err.message : es.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="exportar-titulo"
      className="mb-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <PageHeader id="exportar-titulo" title={es.export.title} info={es.export.intro} />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="mb-3">
        <label htmlFor="conjunto" className="block text-sm font-medium">
          {es.export.dataset}
        </label>
        <select
          id="conjunto"
          value={dataset}
          onChange={(e) => setDataset(e.target.value as (typeof DATASETS)[number])}
          className="mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:w-96"
        >
          {DATASETS.map((d) => (
            <option key={d} value={d}>
              {es.export.datasets[d]}
            </option>
          ))}
        </select>
      </div>
      <label className="mb-1 flex min-h-11 items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={includeText}
          onChange={(e) => setIncludeText(e.target.checked)}
        />
        {es.export.includeText}
      </label>
      <label className="mb-3 flex min-h-11 items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={includeSample}
          onChange={(e) => setIncludeSample(e.target.checked)}
        />
        {es.export.includeSample}
      </label>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void run('json')}>
          {busy ? es.export.working : es.export.json}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void run('csv')}>
          {busy ? es.export.working : es.export.csv}
        </Button>
      </div>
      {done ? <Toast message={done} onClose={() => setDone(null)} /> : null}
    </section>
  );
}
