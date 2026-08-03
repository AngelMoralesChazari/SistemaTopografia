import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import { refreshCurrentUser } from '@lab-topo/services';
import { Button, Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

export function RenterPendingPage() {
  const { user, logout, setSessionUser } = useAuth();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(440, width - 32);
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
    <View style={styles.root}>
      <View style={[styles.card, { width: cardWidth }]}>
        <View style={[styles.iconWrap, rejected && styles.iconWrapDanger]}>
          <MaterialIcons
            name={rejected ? 'cancel' : 'hourglass-top'}
            size={36}
            color={rejected ? theme.color.red : theme.color.navy}
          />
        </View>
        <Text style={styles.title}>
          {rejected ? 'Registro no aprobado' : 'Registro en revisión'}
        </Text>
        <Text style={styles.subtitle}>
          {rejected
            ? 'El laboratorio rechazó tu solicitud de renta. Contacta al encargado para más información.'
            : 'Tu cuenta ya está creada. Un encargado del laboratorio debe aprobarte antes de rentar equipo.'}
        </Text>

        {!rejected ? (
          <Notice
            tone="info"
            title="¿Qué sigue?"
            description="Cuando te aprueben, esta pantalla se actualizará y podrás usar el catálogo de renta."
          />
        ) : null}

        {!rejected ? (
          <Button
            title="Revisar si ya me aprobaron"
            loading={checking}
            onPress={onCheck}
            style={{ marginTop: 16 }}
          />
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
    alignItems: 'center',
    ...theme.shadow.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconWrapDanger: {
    backgroundColor: theme.color.redSoft,
  },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 16,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  logout: {
    marginTop: 18,
    paddingVertical: 8,
  },
  logoutText: {
    color: theme.color.red,
    fontWeight: '700',
  },
});
