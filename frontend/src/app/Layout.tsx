import { Link, Outlet, useNavigate } from 'react-router-dom';
import { es } from '../i18n/es';
import { useSession } from './SessionProvider';

/** Estructura común responsiva (móvil primero): cabecera con navegación y contenido principal. */
export function Layout() {
  const { user, logout } = useSession();
  const navigate = useNavigate();

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-[var(--color-surface)] focus:p-2"
      >
        {es.app.skipToContent}
      </a>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <nav aria-label={es.nav.main} className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/proyectos" className="text-lg font-semibold">
            {es.app.name}
          </Link>
          {user ? (
            <>
              <Link to="/proyectos" className="text-sm underline-offset-4 hover:underline">
                {es.nav.projects}
              </Link>
              <span className="ml-auto text-sm text-[var(--color-muted)]">
                <span className="font-mono">{user.pseudonym}</span>
              </span>
              <button
                type="button"
                className="min-h-11 rounded-md border border-[var(--color-border)] px-3 text-sm"
                onClick={() => void logout().then(() => navigate('/entrar'))}
              >
                {es.nav.logout}
              </button>
            </>
          ) : (
            <span className="ml-auto flex gap-4 text-sm">
              <Link to="/entrar" className="underline-offset-4 hover:underline">
                {es.nav.login}
              </Link>
              <Link to="/registro" className="underline-offset-4 hover:underline">
                {es.nav.register}
              </Link>
            </span>
          )}
        </nav>
      </header>
      <main id="contenido" className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </>
  );
}
