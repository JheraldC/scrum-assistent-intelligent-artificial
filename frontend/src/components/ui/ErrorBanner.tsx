import { es } from '../../i18n/es';

interface Props {
  message: string;
  onRetry?: () => void;
}

/** Mensaje de error claro con acción de reintento; se anuncia a lectores de pantalla. */
export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="my-4 rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-4 text-[var(--color-danger)]"
    >
      <p className="font-medium">
        <span aria-hidden="true">⚠ </span>
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-current px-3 py-1 text-sm font-medium"
        >
          {es.app.retry}
        </button>
      ) : null}
    </div>
  );
}
