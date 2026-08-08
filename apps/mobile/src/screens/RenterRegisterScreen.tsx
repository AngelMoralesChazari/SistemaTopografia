import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@lab-topo/config';
import { registerRenter } from '@lab-topo/services';
import { Button, Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { FormTextField } from '../components/FormTextField';
import { KeyboardFormShell } from '../components/KeyboardFormShell';

type Props = { onBack: () => void };

export function RenterRegisterScreen({ onBack }: Props) {
  const { setSessionUser, firebaseReady, firebaseMessage } = useAuth();
  const { width, height } = useWindowDimensions();
  const logoSize = Math.max(width, height) * 1.1;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [ine, setIne] = useState('');
  const [rfc, setRfc] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    firebaseReady &&
    displayName.trim() &&
    email.trim() &&
    password.length >= 6 &&
    phone.trim() &&
    company.trim() &&
    ine.trim() &&
    rfc.trim() &&
    address.trim();

  const onSubmit = async () => {
    setError(null);
    if (!canSubmit) return;
    setLoading(true);
    try {
      const profile = await registerRenter({
        displayName,
        email,
        password,
        phone,
        company,
        ine,
        rfc,
        address,
      });
      setSessionUser(profile);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'No se pudo registrar';
      if (raw.includes('auth/email-already-in-use')) {
        setError('Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.');
      } else if (raw.includes('auth/invalid-email')) {
        setError('Correo inválido.');
      } else if (raw.includes('auth/weak-password')) {
        setError('La contraseña es demasiado débil (mínimo 6 caracteres).');
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
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
        <Text style={styles.eyebrow}>Renta a particulares</Text>
        <Text style={styles.title}>Registro de renta</Text>
        <Text style={styles.subtitle}>Completa tus datos..</Text>

        {!firebaseReady ? (
          <Notice tone="danger" title="Firebase pendiente" description={firebaseMessage} />
        ) : null}

        <FormTextField label="Nombre completo" value={displayName} onChangeText={setDisplayName} />
        <FormTextField
          label="Correo"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <FormTextField
          label="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 6 caracteres"
        />
        <FormTextField
          label="Teléfono"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <FormTextField
          label="Empresa / institución"
          value={company}
          onChangeText={setCompany}
        />
        <FormTextField label="INE / identificación" value={ine} onChangeText={setIne} />
        <FormTextField
          label="RFC"
          autoCapitalize="characters"
          value={rfc}
          onChangeText={setRfc}
        />
        <FormTextField label="Dirección" value={address} onChangeText={setAddress} />

        {error ? <Notice tone="danger" title={error} /> : null}

        <Button
          title="Enviar registro"
          loading={loading}
          disabled={!canSubmit || loading}
          onPress={onSubmit}
        />

        <Pressable onPress={onBack} style={styles.backLink} disabled={loading}>
          <Text style={styles.backText}>Ya tengo cuenta · Iniciar sesión</Text>
        </Pressable>
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
  title: { color: theme.color.navy, fontSize: 24, fontWeight: '800' },
  subtitle: {
    marginTop: 6,
    marginBottom: theme.space.xl,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  backLink: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  backText: { color: theme.color.navy, fontWeight: '700', fontSize: 13 },
});
