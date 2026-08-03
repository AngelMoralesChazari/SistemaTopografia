import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
  | 'settings'
  | 'catalog'
  | 'studentRequests'
  | 'teacherStudents'
  | 'profile';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

type NavItem = {
  id: WebSection;
  label: string;
  icon: MaterialIconName;
  roles: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', icon: 'dashboard', roles: ['admin', 'lab_manager'] },
  { id: 'dashboard', label: 'Resumen', icon: 'dashboard', roles: ['teacher'] },
  { id: 'catalog', label: 'Catálogo', icon: 'home', roles: ['student'] },
  {
    id: 'studentRequests',
    label: 'Mis solicitudes',
    icon: 'schedule',
    roles: ['student'],
  },
  {
    id: 'teacherStudents',
    label: 'Alumnos',
    icon: 'groups',
    roles: ['teacher'],
  },
  {
    id: 'equipment',
    label: 'Catálogo de equipos',
    icon: 'inventory-2',
    roles: ['admin', 'lab_manager'],
  },
  {
    id: 'requests',
    label: 'Solicitudes activas',
    icon: 'assignment',
    roles: ['admin', 'lab_manager'],
  },
  { id: 'history', label: 'Historial', icon: 'history', roles: ['admin', 'lab_manager'] },
  { id: 'metrics', label: 'Métricas', icon: 'bar-chart', roles: ['admin', 'lab_manager'] },
  { id: 'users', label: 'Usuarios', icon: 'group', roles: ['admin'] },
  { id: 'settings', label: 'Configuración', icon: 'settings', roles: ['admin'] },
  {
    id: 'profile',
    label: 'Perfil',
    icon: 'person-outline',
    roles: ['student', 'admin', 'lab_manager', 'teacher'],
  },
];

export function defaultSectionForRole(role: UserRole): WebSection {
  switch (role) {
    case 'student':
      return 'catalog';
    case 'teacher':
      return 'dashboard';
    case 'lab_manager':
      return 'requests';
    default:
      return 'dashboard';
  }
}

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
  const navLabel =
    user.role === 'student'
      ? 'Espacio del alumno'
      : user.role === 'teacher'
        ? 'Supervisión académica'
        : 'Gestión del laboratorio';

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
          <Avatar initials={getInitials(user.displayName)} size={36} />
          {!compact ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.displayName}
              </Text>
              <Text style={styles.userRole}>{formatRole(user.role)}</Text>
            </View>
          ) : null}
        </View>

        {!compact ? <Text style={styles.navLabel}>{navLabel}</Text> : null}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.navList}>
          {items.map((item) => {
            const active = item.id === section;
            return (
              <Pressable
                key={`${item.id}-${item.label}`}
                onPress={() => onSectionChange(item.id)}
                style={[styles.navItem, active && styles.navItemActive]}
              >
                <MaterialIcons
                  name={item.icon}
                  size={22}
                  color={active ? '#fff' : theme.color.sidebarText}
                />
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
    width: 280,
    backgroundColor: theme.color.navy,
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  sidebarCompact: {
    width: '100%',
    maxHeight: 240,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    marginBottom: 22,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: theme.color.navy,
    fontWeight: '900',
    fontSize: theme.font.size.lg,
  },
  brand: {
    color: '#fff',
    fontSize: theme.font.size.lg,
    fontWeight: '700',
  },
  brandSub: {
    marginTop: 3,
    color: '#9EB1C7',
    fontSize: theme.font.size.sm,
  },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 10,
  },
  userName: {
    color: '#fff',
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  userRole: {
    marginTop: 3,
    color: '#AFC0D4',
    fontSize: theme.font.size.sm,
  },
  navLabel: {
    paddingHorizontal: 11,
    marginBottom: 10,
    color: theme.color.sidebarMuted,
    fontSize: theme.font.size.xs,
    fontWeight: '800',
    letterSpacing: 1.1,
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
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: theme.color.red,
  },
  navText: {
    color: theme.color.sidebarText,
    fontSize: theme.font.size.md,
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
    fontSize: theme.font.size.sm,
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
