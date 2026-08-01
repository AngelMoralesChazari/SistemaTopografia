import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import { formatRole, getInitials } from '@lab-topo/domain';
import { Avatar, Button } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

type PlaceholderProps = {
  title: string;
  subtitle?: string;
};

export function PlaceholderScreen({ title, subtitle }: PlaceholderProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ProfileScreen() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Avatar initials={getInitials(user.displayName)} size={48} />
        <View style={styles.meta}>
          <Text style={styles.name}>{user.displayName}</Text>
          <Text style={styles.role}>{formatRole(user.role)}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
      </View>
      <Button title="Cerrar sesión" variant="secondary" onPress={() => logout()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvasMobile,
    padding: theme.space.xl,
  },
  title: {
    color: theme.color.navy,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 28,
    padding: 16,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  meta: {
    flex: 1,
  },
  name: {
    color: theme.color.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  role: {
    marginTop: 3,
    color: theme.color.muted,
    fontSize: 11,
  },
  email: {
    marginTop: 2,
    color: theme.color.muted,
    fontSize: 10,
  },
});
