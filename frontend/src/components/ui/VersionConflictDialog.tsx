import { Button } from './Button';

interface Props {
  title: string;
  body: string;
  reloadLabel: string;
  keepLabel: string;
  onReload: () => void;
  onKeep: () => void;
}

/** Conflicto de versión (FR-036): recargar la versión actual o seguir editando; nunca se pierde en silencio. */
export function VersionConflictDialog({ title, body, reloadLabel, keepLabel, onReload, onKeep }: Props) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="conflicto-titulo"
      aria-describedby="conflicto-cuerpo"
      className="my-4 rounded-md border-2 border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4 text-[var(--color-warning)]"
    >
      <h3 id="conflicto-titulo" className="font-semibold">
        <span aria-hidden="true">⚠ </span>
        {title}
      </h3>
      <p id="conflicto-cuerpo" className="my-2 text-sm">
        {body}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onReload}>
          {reloadLabel}
        </Button>
        <Button variant="secondary" onClick={onKeep}>
          {keepLabel}
        </Button>
      </div>
    </div>
  );
}
