import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppUser } from '@lab-topo/domain';
import {
  checkFirebaseReady,
  refreshCurrentUser,
  signIn,
  signInWithGoogle,
  signOut,
  watchAuth,
} from '@lab-topo/services';

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  firebaseReady: boolean;
  firebaseMessage: string;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
  clearError: () => void;
  setSessionUser: (user: AppUser | null) => void;
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
      setSessionUser: (next) => setUser(next),
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
      loginWithGoogle: async () => {
        setError(null);
        setLoading(true);
        try {
          const profile = await signInWithGoogle();
          setUser(profile);
        } catch (err) {
          const message =
            err instanceof Error ? mapAuthError(err.message) : 'No se pudo iniciar sesión con Google';
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
      reloadUser: async () => {
        const profile = await refreshCurrentUser();
        if (profile) setUser(profile);
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
  console.warn('[Auth Error Detail]:', raw);
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'No existe una cuenta con ese correo.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Demasiados intentos. Intenta más tarde.';
  }
  if (raw.includes('auth/user-token-expired') || raw.includes('auth/id-token-expired') || raw.includes('sesión expiró')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  if (raw.includes('Firebase no está configurado') || raw.includes('EXPO_PUBLIC_FIREBASE')) {
    return 'Firebase no está configurado. Revisa tu archivo .env.';
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'Ventana de inicio de sesión con Google cerrada.';
  }
  if (raw.includes('auth/cancelled-popup-request')) {
    return 'Solicitud de inicio de sesión cancelada.';
  }
  if (raw.includes('auth/unauthorized-domain')) {
    return 'Dominio no autorizado en Firebase. Agrégalo en Firebase Console > Authentication > Settings > Authorized domains.';
  }
  if (raw.includes('auth/popup-blocked')) {
    return 'Ventana emergente bloqueada por el navegador. Habilita las ventanas emergentes.';
  }
  if (
    raw.includes('Acceso restringido') ||
    raw.includes('Acceso institucional') ||
    raw.includes('cuenta especial') ||
    raw.includes('excepción institucional')
  ) {
    return raw;
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
  return raw || 'No se pudo iniciar sesión. Verifica tus datos.';
}
