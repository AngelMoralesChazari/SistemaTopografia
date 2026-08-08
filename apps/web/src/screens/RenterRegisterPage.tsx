import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import { registerRenter } from '@lab-topo/services';
import { Button, Notice, TextField } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

type RenterRegisterPageProps = {
  onBack: () => void;
};

export function RenterRegisterPage({ onBack }: RenterRegisterPageProps) {
  const { setSessionUser, firebaseReady, firebaseMessage } = useAuth();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(480, width - 32);
  const logoSize = Math.max(width, height) * 0.75;

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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { width: cardWidth }]}>
          <Pressable onPress={onBack} style={styles.backButtonTop} disabled={loading}>
            <MaterialIcons name="arrow-back" size={20} color={theme.color.navy} />
            <Text style={styles.backButtonText}>Volver</Text>
          </Pressable>

          <Text style={styles.eyebrow}>Renta a particulares</Text>
          <Text style={styles.title}>Registro de renta</Text>
          <Text style={styles.subtitle}>
            Completa tu registro para rentar equipos. Validaremos tu solicitud muy pronto.
          </Text>

          {!firebaseReady ? (
            <Notice
              tone="danger"
              title="Firebase pendiente"
              description={firebaseMessage}
            />
          ) : null}
          {error ? <Notice tone="danger" title={error} /> : null}

          <TextField
            label="Nombre"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Nombre completo"
          />
          <TextField
            label="Correo"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="correo@ejemplo.com"
          />
          <TextField
            label="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
          />
          <TextField
            label="Teléfono"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholder="747 123 4567"
            maxLength={10}
          />
          <TextField
            label="Empresa / institución"
            value={company}
            onChangeText={setCompany}
            placeholder="Nombre de la empresa"
          />
          <TextField
            label="INE / identificación"
            value={ine}
            onChangeText={(val) => setIne(val.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="Número o folio de INE"
            maxLength={18}
          />
          <TextField
            label="RFC"
            autoCapitalize="characters"
            value={rfc}
            onChangeText={(val) => setRfc(val.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="RFC"
            maxLength={13}
          />
          <TextField
            label="Dirección"
            value={address}
            onChangeText={setAddress}
            placeholder="Calle, colonia, ciudad"
          />

          <Button
            title="Enviar registro"
            loading={loading}
            disabled={!canSubmit || loading}
            onPress={onSubmit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.navy,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 28,
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
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    lineHeight: 22,
  },
  backButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 20,
    marginTop: -8,
    marginLeft: -4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
  },
  backButtonText: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '700',
    marginLeft: 6,
  },
  bgLogoWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgLogo: {
    opacity: 0.58,
  },
});
