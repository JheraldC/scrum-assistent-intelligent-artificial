import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { useSession } from './SessionProvider';

/** Protege las rutas que exigen sesión; redirige a /entrar conservando el destino. */
export function RequireAuth() {
  const { user, loading } = useSession();
  const location = useLocation();
  if (loading) return <LoadingSkeleton />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
