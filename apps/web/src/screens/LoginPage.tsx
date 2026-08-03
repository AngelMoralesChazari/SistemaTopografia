import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
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
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(420, width - 32);
  // Más grande que la tarjeta para que el anillo se vea a los lados.
  const logoSize = Math.max(width, height) * .75;

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

      <View style={styles.content}>
        <View style={[styles.card, { width: cardWidth }]}>
          {/* <Text style={styles.eyebrow}>UAGro · Laboratorio de Topografía</Text> */}
          <Text style={styles.title}>Iniciar sesión</Text>

          {!firebaseReady ? (
            <Notice
              tone="danger"
              title="Firebase pendiente de configurar"
              description={`${firebaseMessage}. Copia .env.example a apps/web/.env`}
            />
          ) : null}

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100%' as unknown as number,
    backgroundColor: theme.color.navy,
  },
  bgLogoWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgLogo: {
    opacity: 0.58,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 32,
    ...theme.shadow.md,
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
    marginBottom: 14,
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
    color: theme.color.info,
    fontSize: theme.font.size.sm,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
