import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  /** Texto de ayuda que se muestra al pasar el ratón, enfocar o tocar el icono. */
  text: string;
  /** Nombre accesible del botón (por defecto «Más información»). */
  label?: string;
  /** Hacia qué lado se abre el cuadro, para que no se salga de la pantalla. */
  align?: 'left' | 'right';
}

/**
 * Icono «i» con ayuda bajo demanda: mantiene la pantalla limpia y explica para qué sirve cada cuadro.
 * Se abre al pasar el ratón o al recibir el foco, se alterna con un toque o clic y se cierra con Escape.
 */
export function InfoTip({ text, label = 'Más información', align = 'left' }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => !pinned && setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        onClick={() => {
          setPinned(!pinned);
          setOpen(!pinned);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-info)] bg-[var(--color-info-bg)] font-serif text-sm font-bold italic leading-none text-[var(--color-info)]"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={`absolute top-full z-30 mt-1 w-64 max-w-[75vw] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left text-sm font-normal not-italic text-[var(--color-text)] shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
      >
        {text}
      </span>
    </span>
  );
}
