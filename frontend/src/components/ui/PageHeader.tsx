import type { ReactNode } from 'react';
import { InfoTip } from './InfoTip';

interface Props {
  title: ReactNode;
  /** Para qué sirve esta pantalla o sección: se muestra al pasar por el icono «i», no como texto fijo. */
  info?: string;
  id?: string;
  /** Nivel del encabezado: 2 para pantallas, 3 para secciones. */
  level?: 2 | 3;
  className?: string;
}

/** Título de pantalla o sección con su ayuda en un icono «i», para mantener la vista limpia. */
export function PageHeader({ title, info, id, level = 2, className }: Props) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? (level === 2 ? 'mb-3' : 'mb-2')}`}>
      <Tag id={id} className={level === 2 ? 'text-xl font-semibold' : 'text-lg font-semibold'}>
        {title}
      </Tag>
      {info ? <InfoTip text={info} /> : null}
    </div>
  );
}
