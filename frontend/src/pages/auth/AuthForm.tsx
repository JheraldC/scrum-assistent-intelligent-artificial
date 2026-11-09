import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { es } from '../../i18n/es';

/** Formulario común de registro e inicio de sesión (validación en línea y errores claros). */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const isRegister = mode === 'register';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await (isRegister ? register : login)(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/proyectos', { replace: true });
    } catch (error) {
      setFailure(toFormFailure(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">{isRegister ? es.auth.registerTitle : es.auth.loginTitle}</h1>
      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}
      <form onSubmit={onSubmit} noValidate>
        <FormField
          label={es.auth.email}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={failure?.fields.email}
        />
        <FormField
          label={es.auth.password}
          type="password"
          name="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={isRegister ? es.auth.passwordHint : undefined}
          error={failure?.fields.password}
        />
        {isRegister ? <p className="mb-4 text-sm text-[var(--color-muted)]">{es.auth.pseudonymNote}</p> : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? es.common.saving : isRegister ? es.auth.registerButton : es.auth.loginButton}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        {isRegister ? es.auth.haveAccount : es.auth.noAccount}{' '}
        <Link className="underline" to={isRegister ? '/entrar' : '/registro'}>
          {isRegister ? es.nav.login : es.nav.register}
        </Link>
      </p>
    </section>
  );
}
