import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import { formatRole, getInitials } from '@lab-topo/domain';
import { Avatar } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Tu cuenta</Text>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.subtitle}>Datos de tu sesión en el laboratorio.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.identity}>
          <Avatar initials={getInitials(user.displayName)} size={64} />
          <View style={styles.meta}>
            <Text style={styles.name}>{user.displayName}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{formatRole(user.role)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <MaterialIcons name="mail-outline" size={22} color={theme.color.muted} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Correo</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        </View>

        {user.studentId ? (
          <View style={styles.infoRow}>
            <MaterialIcons name="badge" size={22} color={theme.color.muted} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Matrícula</Text>
              <Text style={styles.infoValue}>{user.studentId}</Text>
            </View>
          </View>
        ) : null}

        {user.teacherName ? (
          <View style={styles.infoRow}>
            <MaterialIcons name="school" size={22} color={theme.color.muted} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Profesor asignado</Text>
              <Text style={styles.infoValue}>{user.teacherName}</Text>
            </View>
          </View>
        ) : null}

        {user.role === 'renter' ? (
          <>
            {[
              ['Teléfono', user.phone],
              ['Empresa', user.company],
              ['INE', user.ine],
              ['RFC', user.rfc],
              ['Dirección', user.address],
            ].map(([label, value]) =>
              value ? (
                <View key={label} style={styles.infoRow}>
                  <MaterialIcons name="info-outline" size={22} color={theme.color.muted} />
                  <View style={styles.infoText}>
                    <Text style={styles.infoLabel}>{label}</Text>
                    <Text style={styles.infoValue}>{value}</Text>
                  </View>
                </View>
              ) : null
            )}
          </>
        ) : null}
      </View>

      <Pressable
        onPress={onLogout}
        disabled={busy}
        style={({ pressed }) => [
          styles.logoutBtn,
          pressed && styles.logoutBtnPressed,
          busy && styles.logoutBtnDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={theme.color.red} />
        ) : (
          <>
            <View style={styles.logoutIconWrap}>
              <MaterialIcons name="logout" size={22} color={theme.color.red} />
            </View>
            <View style={styles.logoutTextBlock}>
              <Text style={styles.logoutTitle}>Cerrar sesión</Text>
              <Text style={styles.logoutHint}>Saldrás de esta cuenta en el navegador</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.color.red} />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvas,
    padding: 28,
    maxWidth: 720,
  },
  header: { marginBottom: 20 },
  eyebrow: { color: theme.color.muted, fontSize: theme.font.size.sm, marginBottom: 4 },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 6,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 22,
    ...theme.shadow.soft,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  meta: { flex: 1, minWidth: 0 },
  name: {
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: theme.color.infoSoft,
  },
  roleText: {
    color: theme.color.info,
    fontSize: theme.font.size.sm,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF0F3',
    marginVertical: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  infoText: { flex: 1, minWidth: 0 },
  infoLabel: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    fontWeight: '600',
  },
  infoValue: {
    marginTop: 3,
    color: theme.color.ink,
    fontSize: theme.font.size.lg,
    fontWeight: '700',
  },
  logoutBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0C7CF',
    backgroundColor: theme.color.redSoft,
  },
  logoutBtnPressed: { opacity: 0.88 },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  logoutTextBlock: { flex: 1 },
  logoutTitle: {
    color: theme.color.red,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
  },
  logoutHint: {
    marginTop: 3,
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },
});
