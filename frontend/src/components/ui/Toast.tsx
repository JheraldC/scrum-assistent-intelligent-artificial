import { useEffect } from 'react';
import { es } from '../../i18n/es';

interface Props {
  message: string;
  onClose: () => void;
  /** Se cierra sola para no tapar el contenido (por defecto 5 s). */
  autoCloseMs?: number;
}

/** Aviso de éxito no intrusivo; `aria-live` lo anuncia sin quitar el foco y se cierra solo. */
export function Toast({ message, onClose, autoCloseMs = 5000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(timer);
  }, [message, autoCloseMs, onClose]);

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
