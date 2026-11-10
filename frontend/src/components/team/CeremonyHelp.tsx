import { es } from '../../i18n/es';

type Ceremony = 'PLANNING' | 'DAILY' | 'REVIEW' | 'RETROSPECTIVE';

/** Ayuda breve y opcional para conversar en cada evento Scrum: no es un formulario obligatorio. */
export function CeremonyHelp({ ceremony }: { ceremony: Ceremony }) {
  const data = es.ceremonies[ceremony];
  return (
    <details className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm" data-ceremony={ceremony}>
      <summary className="min-h-6 cursor-pointer font-medium">
        {es.ceremonies.toggle}: {data.title}
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {data.prompts.map((prompt) => (
          <li key={prompt}>{prompt}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[var(--color-muted)]">{es.ceremonies.note}</p>
    </details>
  );
}
