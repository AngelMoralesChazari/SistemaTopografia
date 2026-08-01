import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { theme } from '@lab-topo/config';
import { formatRole, getInitials, type UserRole } from '@lab-topo/domain';
import { Avatar, Button } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

export type WebSection =
  | 'dashboard'
  | 'equipment'
  | 'requests'
  | 'history'
  | 'users'
  | 'metrics'
  | 'settings';

type NavItem = {
  id: WebSection;
  label: string;
  icon: string;
  roles: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', icon: '▦', roles: ['admin', 'lab_manager', 'teacher'] },
  { id: 'equipment', label: 'Catálogo de equipos', icon: '▣', roles: ['admin', 'lab_manager'] },
  { id: 'requests', label: 'Solicitudes activas', icon: '◷', roles: ['admin', 'lab_manager'] },
  { id: 'history', label: 'Historial', icon: '↺', roles: ['admin', 'lab_manager', 'teacher'] },
  { id: 'metrics', label: 'Métricas', icon: '⌁', roles: ['admin', 'lab_manager'] },
  { id: 'users', label: 'Usuarios', icon: '◯', roles: ['admin'] },
  { id: 'settings', label: 'Configuración', icon: '⚙', roles: ['admin'] },
];

type AppShellProps = {
  section: WebSection;
  onSectionChange: (section: WebSection) => void;
  children: React.ReactNode;
};

export function AppShell({ section, onSectionChange, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 900;

  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>LT</Text>
          </View>
          {!compact ? (
            <View>
              <Text style={styles.brand}>Lab Topografía</Text>
              <Text style={styles.brandSub}>UAGro</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.userBox}>
          <Avatar initials={getInitials(user.displayName)} size={28} />
          {!compact ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.displayName}
              </Text>
              <Text style={styles.userRole}>{formatRole(user.role)}</Text>
            </View>
          ) : null}
        </View>

        {!compact ? <Text style={styles.navLabel}>Gestión del laboratorio</Text> : null}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.navList}>
          {items.map((item) => {
            const active = item.id === section;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSectionChange(item.id)}
                style={[styles.navItem, active && styles.navItemActive]}
              >
                <Text style={[styles.navIcon, active && styles.navIconActive]}>{item.icon}</Text>
                {!compact ? (
                  <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          {!compact ? (
            <Text style={styles.footerText}>
              Sesión: <Text style={styles.footerBold}>{formatRole(user.role)}</Text>
            </Text>
          ) : null}
          <Button title={compact ? 'Salir' : 'Cerrar sesión'} variant="secondary" onPress={() => logout()} />
        </View>
      </View>

      <View style={styles.main}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100%' as unknown as number,
    backgroundColor: theme.color.canvas,
  },
  shellCompact: {
    flexDirection: 'column',
  },
  sidebar: {
    width: 248,
    backgroundColor: theme.color.navy,
    paddingTop: 25,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  sidebarCompact: {
    width: '100%',
    maxHeight: 220,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 10,
    marginBottom: 22,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: theme.color.navy,
    fontWeight: '900',
    fontSize: 12,
  },
  brand: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  brandSub: {
    marginTop: 3,
    color: '#9EB1C7',
    fontSize: 10,
  },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 10,
  },
  userName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  userRole: {
    marginTop: 2,
    color: '#AFC0D4',
    fontSize: 9,
  },
  navLabel: {
    paddingHorizontal: 11,
    marginBottom: 9,
    color: theme.color.sidebarMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  navList: {
    gap: 4,
    paddingBottom: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: theme.color.red,
  },
  navIcon: {
    width: 18,
    color: theme.color.sidebarText,
    fontSize: 14,
    textAlign: 'center',
  },
  navIconActive: {
    color: '#fff',
  },
  navText: {
    color: theme.color.sidebarText,
    fontSize: 12,
  },
  navTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    marginTop: 'auto' as unknown as number,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    gap: 10,
  },
  footerText: {
    color: '#8197B0',
    fontSize: 10,
    marginBottom: 4,
  },
  footerBold: {
    color: '#C3D1DF',
    fontWeight: '700',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
});
