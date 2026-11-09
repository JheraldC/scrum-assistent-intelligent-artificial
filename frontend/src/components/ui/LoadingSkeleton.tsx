import { es } from '../../i18n/es';

/** Esqueleto de carga; el texto oculto se anuncia como estado de carga. */
export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" aria-live="polite" className="my-4 animate-pulse space-y-3">
      <span className="sr-only">{es.app.loading}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 rounded bg-[var(--color-border)]" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
