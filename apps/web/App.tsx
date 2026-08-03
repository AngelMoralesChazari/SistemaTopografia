import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@lab-topo/config';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AppShell, defaultSectionForRole, type WebSection } from './src/layout/AppShell';
import { LoginPage } from './src/screens/LoginPage';
import { RenterPendingPage } from './src/screens/RenterPendingPage';
import { RenterRegisterPage } from './src/screens/RenterRegisterPage';
import { SectionPage } from './src/screens/SectionPage';

function WebRoot() {
  const { user, loading } = useAuth();
  const [section, setSection] = useState<WebSection>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (user) {
      setSection(defaultSectionForRole(user.role));
      setAuthView('login');
    }
  }, [user?.uid, user?.role]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={theme.color.navy} size="large" />
      </View>
    );
  }

  if (!user) {
    if (authView === 'register') {
      return <RenterRegisterPage onBack={() => setAuthView('login')} />;
    }
    return <LoginPage onGoRegister={() => setAuthView('register')} />;
  }

  if (user.role === 'renter' && user.renterStatus !== 'approved') {
    return <RenterPendingPage />;
  }

  return (
    <AppShell section={section} onSectionChange={setSection}>
      <SectionPage section={section} />
    </AppShell>
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
