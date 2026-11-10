import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'sm';

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--color-primary)] text-[var(--color-primary-contrast)] border-transparent',
  secondary: 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)]',
  danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]',
};

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 py-2 text-base',
  // Para zonas densas como el panel del asistente.
  sm: 'min-h-8 px-3 py-1 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={`rounded-md border font-medium disabled:opacity-60 ${sizes[size]} ${variants[variant]} ${className}`} />;
}
