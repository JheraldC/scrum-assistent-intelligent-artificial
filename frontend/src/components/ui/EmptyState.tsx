import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Estado vacío: mensaje y acción sugerida. */
export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="my-8 rounded-md border border-dashed border-[var(--color-border)] p-6 text-center">
      <p className="text-lg font-medium">{title}</p>
      {description ? <p className="mt-1 text-[var(--color-muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
