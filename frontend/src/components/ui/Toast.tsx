import { es } from '../../i18n/es';

interface Props {
  message: string;
  onClose: () => void;
}

/** Aviso de éxito no intrusivo; `aria-live` lo anuncia sin quitar el foco. */
export function Toast({ message, onClose }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-md border border-[var(--color-success)] bg-[var(--color-success-bg)] p-3 text-[var(--color-success)] shadow"
    >
      <span aria-hidden="true">✓ </span>
      {message}
      <button type="button" onClick={onClose} className="ml-3 underline">
        {es.common.close}
      </button>
    </div>
  );
}
