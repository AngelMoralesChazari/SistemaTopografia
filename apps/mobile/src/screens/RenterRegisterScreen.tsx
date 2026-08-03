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
import { registerRenter } from '@lab-topo/services';
import { Button, Notice, TextField } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

type Props = { onBack: () => void };

export function RenterRegisterScreen({ onBack }: Props) {
  const { setSessionUser, firebaseReady, firebaseMessage } = useAuth();
  const insets = useSafeAreaInsets();

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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Renta a particulares</Text>
          <Text style={styles.title}>Registro de renta</Text>
          <Text style={styles.subtitle}>
            Completa tus datos..
          </Text>

          {!firebaseReady ? (
            <Notice tone="danger" title="Firebase pendiente" description={firebaseMessage} />
          ) : null}
          {error ? <Notice tone="danger" title={error} /> : null}

          <TextField label="Nombre completo" value={displayName} onChangeText={setDisplayName} />
          <TextField
            label="Correo"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
          />
          <TextField label="Teléfono" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <TextField label="Empresa / institución" value={company} onChangeText={setCompany} />
          <TextField label="INE / identificación" value={ine} onChangeText={setIne} />
          <TextField
            label="RFC"
            autoCapitalize="characters"
            value={rfc}
            onChangeText={setRfc}
          />
          <TextField label="Dirección" value={address} onChangeText={setAddress} />

          <Button title="Enviar registro" loading={loading} disabled={!canSubmit || loading} onPress={onSubmit} />

          <Pressable onPress={onBack} style={styles.backLink} disabled={loading}>
            <Text style={styles.backText}>Ya tengo cuenta · Iniciar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvasMobile },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.space.xxl },
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
