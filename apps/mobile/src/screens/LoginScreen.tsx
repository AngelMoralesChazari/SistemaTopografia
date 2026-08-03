import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import { Button, Notice, TextField } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

type LoginScreenProps = {
  onGoRegister?: () => void;
};

export function LoginScreen({ onGoRegister }: LoginScreenProps) {
  const { login, loading, error, clearError, firebaseReady, firebaseMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const insets = useSafeAreaInsets();

  const onSubmit = async () => {
    clearError();
    if (!email.trim() || !password) return;
    try {
      await login(email, password);
    } catch {
      // error ya mapeado en context
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.logo}>
            <Text style={styles.logoMark}>LT</Text>
          </View>
          <Text style={styles.eyebrow}>UAGro · Laboratorio de Topografía</Text>
          <Text style={styles.title}>Iniciar sesión</Text>
          <Text style={styles.subtitle}>
            Universidad o renta de equipo · correo y contraseña.
          </Text>

          {!firebaseReady ? (
            <Notice
              tone="danger"
              title="Firebase pendiente de configurar"
              description={`${firebaseMessage}. Copia .env.example a apps/mobile/.env`}
            />
          ) : null}

          {error ? <Notice tone="danger" title={error} /> : null}

          <TextField
            label="Correo"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="usuario@uagro.mx"
          />
          <TextField
            label="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />

          <Button
            title="Entrar"
            loading={loading}
            disabled={!firebaseReady || !email.trim() || !password}
            onPress={onSubmit}
          />

          {onGoRegister ? (
            <Pressable
              onPress={onGoRegister}
              style={styles.registerLink}
              accessibilityRole="link"
              accessibilityLabel="Registro para renta de equipo"
            >
              <Text style={styles.registerLabel}>Particulares</Text>
              <Text style={styles.registerAnchor}>Registro para renta de equipo</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvasMobile,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxl,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: theme.space.xxl,
    ...theme.shadow.soft,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.color.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.lg,
  },
  logoMark: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: -0.5,
  },
  eyebrow: {
    color: theme.color.red,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: theme.color.navy,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: theme.space.xl,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  registerLink: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  registerLabel: {
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: 13,
  },
  registerAnchor: {
    marginTop: 4,
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
