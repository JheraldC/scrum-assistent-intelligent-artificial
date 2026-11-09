import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, resetCsrf } from '../api/client';
import type { Me } from '../api/types';

interface SessionValue {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<Me>('/auth/me')
      .then((me) => active && setUser(me))
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 401)) console.error(error);
        if (active) setUser(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await api<Me>('/auth/login', { method: 'POST', body: { email, password } });
    resetCsrf(); // la sesión nueva cambia el token CSRF
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await api<Me>('/auth/register', { method: 'POST', body: { email, password } });
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    resetCsrf();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider');
  return value;
}
