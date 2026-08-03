import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { theme } from '@lab-topo/config';
import { Button, Notice, TextField } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

type LoginPageProps = {
  onGoRegister?: () => void;
};

export function LoginPage({ onGoRegister }: LoginPageProps) {
  const { login, loading, error, clearError, firebaseReady, firebaseMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(420, width - 32);

  const onSubmit = async () => {
    clearError();
    if (!email.trim() || !password) return;
    try {
      await login(email, password);
    } catch {
      // handled
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.card, { width: cardWidth }]}>
        <View style={styles.logo}>
          <Text style={styles.logoMark}>LT</Text>
        </View>
        <Text style={styles.eyebrow}>UAGro · Laboratorio de Topografía</Text>
        <Text style={styles.title}>Iniciar sesión</Text>
        <Text style={styles.subtitle}>
          Accede con tu correo y contraseña.
        </Text>

        {!firebaseReady ? (
          <Notice
            tone="danger"
            title="Firebase pendiente de configurar"
            description={`${firebaseMessage}. Copia .env.example a apps/web/.env`}
          />
        ) : null}

        {error ? <Notice tone="danger" title={error} /> : null}

        <TextField
          label="Correo"
          autoCapitalize="none"
          keyboardType="email-address"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100%' as unknown as number,
    backgroundColor: theme.color.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 32,
    ...theme.shadow.md,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.color.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoMark: {
    color: '#fff',
    fontWeight: '900',
    fontSize: theme.font.size.lg,
  },
  eyebrow: {
    color: theme.color.red,
    fontSize: theme.font.size.sm,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    lineHeight: 22,
  },
  registerLink: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  registerLabel: {
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: theme.font.size.md,
  },
  registerAnchor: {
    marginTop: 4,
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    fontWeight: '600',
  },
});
