import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { es } from '../../i18n/es';
import { InfoTip } from './InfoTip';

interface BaseProps {
  label: string;
  /** Ayuda del campo: se muestra en un icono «i» junto a la etiqueta para no ocupar espacio. */
  hint?: string;
  error?: string;
}

type InputProps = BaseProps & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;
type TextareaProps = BaseProps & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

const fieldBase = 'mt-1 block w-full rounded-md border bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text)]';
const okBorder = 'border-[var(--color-border)]';
const badBorder = 'border-2 border-[var(--color-danger)] bg-[var(--color-danger-bg)]';

/**
 * Campo de formulario accesible. Los obligatorios llevan un asterisco rojo; si quedan vacíos al salir
 * del campo, o el servidor devuelve un error, el borde y el mensaje se muestran en rojo (con icono y
 * texto, no solo color) y se anuncian con aria-describedby.
 */
export function FormField(props: InputProps | TextareaProps): ReactNode {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const { label, hint, error } = props;
  const required = Boolean(props.required);
  const emptyRequired = required && touched && String(props.value ?? '').trim() === '';
  const shown = error ?? (emptyRequired ? es.common.required : undefined);
  const describedBy = shown ? `${id}-error` : undefined;
  const common = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': shown ? true : undefined,
    className: `${fieldBase} ${shown ? badBorder : okBorder}`,
  } as const;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
          {required ? (
            <span className="text-[var(--color-danger)]" aria-hidden="true">
              {' '}
              *
            </span>
          ) : null}
        </label>
        {hint ? <InfoTip text={hint} label={es.common.help} /> : null}
      </div>
      {props.multiline ? (
        (() => {
          const { label: _l, hint: _h, error: _e, multiline: _m, onBlur, ...rest } = props;
          return (
            <textarea
              {...rest}
              {...common}
              onBlur={(e) => {
                setTouched(true);
                onBlur?.(e);
              }}
            />
          );
        })()
      ) : (
        (() => {
          const { label: _l, hint: _h, error: _e, multiline: _m, onBlur, ...rest } = props;
          return (
            <input
              {...rest}
              {...common}
              onBlur={(e) => {
                setTouched(true);
                onBlur?.(e);
              }}
            />
          );
        })()
      )}
      {shown ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-[var(--color-danger)]">
          <span aria-hidden="true">⚠ </span>
          {shown}
        </p>
      ) : null}
    </div>
  );
}
