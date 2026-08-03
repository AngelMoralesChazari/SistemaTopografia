import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import { formatRole, getInitials } from '@lab-topo/domain';
import { Avatar } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <View>
          <Text style={styles.hello}>Tu cuenta</Text>
          <Text style={styles.title}>Perfil</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.identity}>
          <Avatar initials={getInitials(user.displayName)} size={52} />
          <View style={styles.meta}>
            <Text style={styles.name}>{user.displayName}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{formatRole(user.role)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <MaterialIcons name="mail-outline" size={18} color={theme.color.muted} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Correo</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        </View>

        {user.studentId ? (
          <View style={styles.infoRow}>
            <MaterialIcons name="badge" size={18} color={theme.color.muted} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Matrícula</Text>
              <Text style={styles.infoValue}>{user.studentId}</Text>
            </View>
          </View>
        ) : null}

        {user.teacherName ? (
          <View style={styles.infoRow}>
            <MaterialIcons name="school" size={18} color={theme.color.muted} />
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
                  <MaterialIcons name="info-outline" size={18} color={theme.color.muted} />
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

      <View style={styles.spacer} />

      <Pressable
        onPress={onLogout}
        disabled={busy}
        style={({ pressed }) => [
          styles.logoutBtn,
          pressed && styles.logoutBtnPressed,
          busy && styles.logoutBtnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
      >
        {busy ? (
          <ActivityIndicator color={theme.color.red} />
        ) : (
          <>
            <View style={styles.logoutIconWrap}>
              <MaterialIcons name="logout" size={20} color={theme.color.red} />
            </View>
            <View style={styles.logoutTextBlock}>
              <Text style={styles.logoutTitle}>Cerrar sesión</Text>
              <Text style={styles.logoutHint}>Saldrás de esta cuenta en el dispositivo</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.color.red} />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvasMobile,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  head: {
    marginTop: 8,
    marginBottom: 16,
  },
  hello: {
    color: theme.color.muted,
    fontSize: 11,
    marginBottom: 2,
  },
  title: {
    color: theme.color.navy,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 16,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: theme.color.navy,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: theme.color.infoSoft,
  },
  roleText: {
    color: theme.color.info,
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF0F3',
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  infoText: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  infoValue: {
    marginTop: 2,
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3C9D0',
    backgroundColor: theme.color.redSoft,
  },
  logoutBtnPressed: {
    opacity: 0.88,
    backgroundColor: '#FFE8EC',
  },
  logoutBtnDisabled: {
    opacity: 0.6,
  },
  logoutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3C9D0',
  },
  logoutTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  logoutTitle: {
    color: theme.color.red,
    fontSize: 14,
    fontWeight: '800',
  },
  logoutHint: {
    marginTop: 2,
    color: '#A84A5A',
    fontSize: 10,
    lineHeight: 14,
  },
});
