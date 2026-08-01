import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@lab-topo/config';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AppShell, type WebSection } from './src/layout/AppShell';
import { LoginPage } from './src/screens/LoginPage';
import { SectionPage } from './src/screens/SectionPage';

function WebRoot() {
  const { user, loading } = useAuth();
  const [section, setSection] = useState<WebSection>('dashboard');

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={theme.color.navy} size="large" />
      </View>
    );
  }

  if (!user) {
    return <LoginPage />;
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
