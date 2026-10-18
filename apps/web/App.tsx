import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@lab-topo/config';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import {
  AppShell,
  defaultSectionForRole,
  isSectionAllowed,
  VALID_SECTIONS,
  type WebSection,
} from './src/layout/AppShell';
import { LoginPage } from './src/screens/LoginPage';
import { RenterPendingPage } from './src/screens/RenterPendingPage';
import { RenterRegisterPage } from './src/screens/RenterRegisterPage';
import { SectionPage } from './src/screens/SectionPage';
import { StudentGroupOnboardingModal } from './src/components/StudentGroupOnboardingModal';

function getHashPath(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hash.replace(/^#\/?/, '').trim();
}

function WebRoot() {
  const { user, loading } = useAuth();
  const [section, setSection] = useState<WebSection>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const userRef = useRef(user);
  userRef.current = user;

  // Sincronización inicial y cuando cambia el usuario (login/logout)
  useEffect(() => {
    if (loading) return;

    if (!user) {
      const path = getHashPath();
      const nextView = path === 'register' ? 'register' : 'login';
      setAuthView(nextView);
      if (typeof window !== 'undefined') {
        window.history.replaceState({ authView: nextView }, '', `#/${nextView}`);
      }
      return;
    }

    // Usuario autenticado
    const path = getHashPath() as WebSection;
    let initialSection: WebSection = defaultSectionForRole(user.role);

    if (VALID_SECTIONS.includes(path) && isSectionAllowed(path, user.role)) {
      initialSection = path;
    }

    setSection(initialSection);
    setAuthView('login');
    if (typeof window !== 'undefined') {
      window.history.replaceState({ section: initialSection }, '', `#/${initialSection}`);
    }
  }, [user?.uid, user?.role, loading]);

  // Manejo de cambio de sección con historial del navegador (pushState)
  const handleSectionChange = useCallback((nextSection: WebSection) => {
    setSection((current) => {
      if (current === nextSection) return current;
      if (typeof window !== 'undefined') {
        window.history.pushState({ section: nextSection }, '', `#/${nextSection}`);
      }
      return nextSection;
    });
  }, []);

  const handleGoRegister = useCallback(() => {
    setAuthView('register');
    if (typeof window !== 'undefined') {
      window.history.pushState({ authView: 'register' }, '', '#/register');
    }
  }, []);

  const handleBackToLogin = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      setAuthView('login');
      if (typeof window !== 'undefined') {
        window.history.replaceState({ authView: 'login' }, '', '#/login');
      }
    }
  }, []);

  // Escuchar botones "Atrás" y "Adelante" del navegador y gestos del sistema en PWA
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSyncFromHistory = (event?: PopStateEvent) => {
      const currentUser = userRef.current;
      const path = getHashPath();

      if (!currentUser) {
        const nextAuthView = path === 'register' ? 'register' : 'login';
        setAuthView(nextAuthView);
        return;
      }

      // Usuario autenticado
      const stateSection = event?.state?.section as WebSection | undefined;
      const target = (stateSection || path) as WebSection;

      if (target && VALID_SECTIONS.includes(target) && isSectionAllowed(target, currentUser.role)) {
        setSection(target);
      } else {
        const fallback = defaultSectionForRole(currentUser.role);
        setSection(fallback);
        window.history.replaceState({ section: fallback }, '', `#/${fallback}`);
      }
    };

    window.addEventListener('popstate', handleSyncFromHistory);
    window.addEventListener('hashchange', handleSyncFromHistory as EventListener);

    return () => {
      window.removeEventListener('popstate', handleSyncFromHistory);
      window.removeEventListener('hashchange', handleSyncFromHistory as EventListener);
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={theme.color.navy} size="large" />
      </View>
    );
  }

  if (!user) {
    if (authView === 'register') {
      return <RenterRegisterPage onBack={handleBackToLogin} />;
    }
    return <LoginPage onGoRegister={handleGoRegister} />;
  }

  if (user.role === 'renter' && user.renterStatus !== 'approved') {
    return <RenterPendingPage />;
  }

  return (
    <>
      <AppShell section={section} onSectionChange={handleSectionChange}>
        <SectionPage section={section} onSectionChange={handleSectionChange} />
      </AppShell>
      <StudentGroupOnboardingModal />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <WebRoot />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    minHeight: '100%' as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.canvas,
  },
});
