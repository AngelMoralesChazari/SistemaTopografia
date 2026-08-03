import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@lab-topo/config';
import { Button, Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { FormTextField } from '../components/FormTextField';
import { KeyboardFormShell } from '../components/KeyboardFormShell';

type LoginScreenProps = {
  onGoRegister?: () => void;
};

export function LoginScreen({ onGoRegister }: LoginScreenProps) {
  const { login, loading, error, clearError, firebaseReady, firebaseMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { width, height } = useWindowDimensions();
  const logoSize = Math.max(width, height) * 1.1;

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
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[theme.color.navy, theme.color.navy2, theme.color.navyHover]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.bgLogoWrap} pointerEvents="none">
        <Image
          source={require('../../assets/logo-uagro-bg-v2.png')}
          style={[styles.bgLogo, { width: logoSize, height: logoSize }]}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      <KeyboardFormShell backgroundColor="transparent">
        <View style={styles.card}>
          {/* <Text style={styles.eyebrow}>UAGro · Laboratorio de Topografía</Text> */}
          <Text style={styles.title}>Iniciar sesión</Text>

          {!firebaseReady ? (
            <Notice
              tone="danger"
              title="Firebase pendiente de configurar"
              description={`${firebaseMessage}. Copia .env.example a apps/mobile/.env`}
            />
          ) : null}

          <FormTextField
            label="Correo"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="usuario@uagro.mx"
          />
          <FormTextField
            label="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />

          {error ? <Notice tone="danger" title={error} /> : null}

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
      </KeyboardFormShell>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.navy,
  },
  bgLogoWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgLogo: {
    opacity: 0.55,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: theme.space.xxl,
    ...theme.shadow.soft,
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
    marginBottom: 14,
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
    color: theme.color.info,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
