import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--color-primary)] text-[var(--color-primary-contrast)] border-transparent',
  secondary: 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)]',
  danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-11 rounded-md border px-4 py-2 text-base font-medium disabled:opacity-60 ${variants[variant]} ${className}`}
    />
  );
}
