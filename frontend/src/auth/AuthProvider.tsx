import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, Rol } from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  rol: Rol | null;
  isLoading: boolean;
  step: 'loading' | 'email' | 'otp' | 'authenticated';
  error: string | null;
  submitEmail: (email: string) => Promise<void>;
  submitOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, rol: null, isLoading: true, step: 'loading',
  error: null,
  submitEmail: async () => undefined,
  submitOtp: async () => undefined,
  logout: async () => undefined,
});

const BASE = '/api/v1';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json() as { data?: T; error?: { code: string; message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? 'Error desconocido');
  return json.data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [step, setStep] = useState<'loading' | 'email' | 'otp' | 'authenticated'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuthUser>('/auth/me')
      .then((u) => { setUser(u); setStep('authenticated'); })
      .catch(() => setStep('email'));
  }, []);

  const submitEmail = useCallback(async (email: string) => {
    setError(null);
    try {
      await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email }) });
      setStep('otp');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const submitOtp = useCallback(async (email: string, code: string) => {
    setError(null);
    try {
      const res = await apiFetch<{ token: string }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      localStorage.setItem('scp_token', res.token);
      const u = await apiFetch<AuthUser>('/auth/me');
      setUser(u);
      setStep('authenticated');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    localStorage.removeItem('scp_token');
    setUser(null);
    setStep('email');
  }, []);

  return (
    <AuthContext.Provider value={{
      user, rol: user?.rol ?? null,
      isLoading: step === 'loading',
      step, error, submitEmail, submitOtp, logout,
    }}>
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
