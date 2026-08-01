import React, { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { theme } from '@lab-topo/config';
import { Button, Notice, TextField } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
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
        <Text style={styles.title}>Panel administrativo</Text>
        <Text style={styles.subtitle}>
          Inventario, solicitudes y supervisión del laboratorio.
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
    padding: 28,
    ...theme.shadow.md,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.color.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoMark: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  eyebrow: {
    color: theme.color.red,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: theme.color.navy,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
