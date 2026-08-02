import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppUser } from '@lab-topo/domain';
import { checkFirebaseReady, signIn, signOut, watchAuth } from '@lab-topo/services';

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  firebaseReady: boolean;
  firebaseMessage: string;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ready = checkFirebaseReady();

  useEffect(() => {
    if (!ready.ok) {
      setLoading(false);
      return;
    }

    const unsubscribe = watchAuth(
      (next) => {
        setUser(next);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [ready.ok]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      firebaseReady: ready.ok,
      firebaseMessage: ready.message,
      error,
      clearError: () => setError(null),
      login: async (email, password) => {
        setError(null);
        setLoading(true);
        try {
          const profile = await signIn(email, password);
          setUser(profile);
        } catch (err) {
          const message =
            err instanceof Error ? mapAuthError(err.message) : 'No se pudo iniciar sesión';
          setError(message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      logout: async () => {
        await signOut();
        setUser(null);
      },
    }),
    [user, loading, ready.ok, ready.message, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

function mapAuthError(raw: string): string {
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'No existe una cuenta con ese correo.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Demasiados intentos. Intenta más tarde.';
  }
  if (raw.includes('auth/user-token-expired') || raw.includes('auth/id-token-expired')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  if (raw.includes('Firebase no está configurado') || raw.includes('EXPO_PUBLIC_FIREBASE')) {
    return 'Firebase no está configurado. Revisa tu archivo .env.';
  }
  if (
    raw.includes('perfil') ||
    raw.includes('Firestore') ||
    raw.includes('rol') ||
    raw.includes('desactivada') ||
    raw.includes('seed:users')
  ) {
    return raw;
  }
  return 'No se pudo iniciar sesión. Verifica tus datos.';
}
