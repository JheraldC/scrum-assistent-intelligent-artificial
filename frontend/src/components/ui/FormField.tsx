import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
}

type InputProps = BaseProps & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;
type TextareaProps = BaseProps & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

const fieldClass =
  'mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text)]';

/** Campo de formulario accesible: etiqueta asociada, ayuda y error anunciados con aria-describedby. */
export function FormField(props: InputProps | TextareaProps): ReactNode {
  const id = useId();
  const { label, hint, error } = props;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  const common = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined } as const;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {props.multiline ? (
        (() => {
          const { label: _l, hint: _h, error: _e, multiline: _m, ...rest } = props;
          return <textarea {...rest} {...common} className={fieldClass} />;
        })()
      ) : (
        (() => {
          const { label: _l, hint: _h, error: _e, multiline: _m, ...rest } = props;
          return <input {...rest} {...common} className={fieldClass} />;
        })()
      )}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-[var(--color-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-[var(--color-danger)]">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
