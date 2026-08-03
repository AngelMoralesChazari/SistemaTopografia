import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import { refreshCurrentUser } from '@lab-topo/services';
import { Button, Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

export function RenterPendingScreen() {
  const { user, logout, setSessionUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const rejected = user?.renterStatus === 'rejected';

  useEffect(() => {
    if (!user || user.role !== 'renter' || user.renterStatus === 'approved') return;
    const id = setInterval(async () => {
      try {
        const next = await refreshCurrentUser();
        if (next) setSessionUser(next);
      } catch {
        // ignore
      }
    }, 8000);
    return () => clearInterval(id);
  }, [user?.uid, user?.renterStatus, setSessionUser]);

  const onCheck = async () => {
    setChecking(true);
    try {
      const next = await refreshCurrentUser();
      if (next) setSessionUser(next);
    } finally {
      setChecking(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top, 16) + 8,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        },
      ]}
    >
      <View style={styles.card}>
        <View style={[styles.iconWrap, rejected && styles.iconWrapDanger]}>
          <MaterialIcons
            name={rejected ? 'cancel' : 'hourglass-top'}
            size={32}
            color={rejected ? theme.color.red : theme.color.navy}
          />
        </View>
        <Text style={styles.title}>
          {rejected ? 'Registro no aprobado' : 'Registro en revisión'}
        </Text>
        <Text style={styles.subtitle}>
          {rejected
            ? 'El laboratorio rechazó tu solicitud. Contacta al encargado.'
            : 'Un encargado debe aprobarte antes de rentar equipo.'}
        </Text>

        {!rejected ? (
          <Notice
            tone="info"
            title="¿Qué sigue?"
            description="Cuando te aprueben, esta pantalla se actualizará sola."
          />
        ) : null}

        {!rejected ? (
          <Button title="Revisar si ya me aprobaron" loading={checking} onPress={onCheck} />
        ) : null}

        <Pressable onPress={() => logout()} style={styles.logout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvasMobile,
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxl,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: theme.space.xxl,
    alignItems: 'center',
    ...theme.shadow.soft,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconWrapDanger: { backgroundColor: theme.color.redSoft },
  title: {
    color: theme.color.navy,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  logout: { marginTop: 16, paddingVertical: 8 },
  logoutText: { color: theme.color.red, fontWeight: '700' },
});
