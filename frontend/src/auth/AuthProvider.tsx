import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, type AuthUser, type Rol } from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  rol: Rol | null;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  rol: null,
  isLoading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then((u) => setUser(u))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, rol: user?.rol ?? null, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function useRequireRole(roles: Rol[]): boolean {
  const { rol } = useAuth();
  return rol !== null && roles.includes(rol);
}
