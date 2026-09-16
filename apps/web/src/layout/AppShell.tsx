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
  | 'manageEquipment'
  | 'requests'
  | 'history'
  | 'reports'
  | 'users'
  | 'metrics'
  | 'settings'
  | 'catalog'
  | 'studentRequests'
  | 'teacherStudents'
  | 'renters'
  | 'audit'
  | 'profile';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

type NavItem = {
  id: WebSection;
  label: string;
  icon: MaterialIconName;
  roles: UserRole[];
};

const ALL_ROLES: UserRole[] = ['student', 'teacher', 'renter', 'lab_manager', 'admin', 'super_admin'];
const LAB_ADMIN: UserRole[] = ['lab_manager', 'admin', 'super_admin'];
const STAFF_ADMIN: UserRole[] = ['admin', 'super_admin'];

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', icon: 'dashboard', roles: LAB_ADMIN },
  { id: 'dashboard', label: 'Resumen', icon: 'dashboard', roles: ['teacher'] },
  { id: 'catalog', label: 'Catálogo de equipos', icon: 'home', roles: ALL_ROLES },
  {
    id: 'manageEquipment',
    label: 'Gestión de equipos',
    icon: 'tune',
    roles: LAB_ADMIN,
  },
  {
    id: 'studentRequests',
    label: 'Mis solicitudes',
    icon: 'schedule',
    roles: ['student', 'teacher', 'renter'],
  },
  {
    id: 'teacherStudents',
    label: 'Alumnos',
    icon: 'groups',
    roles: ['teacher'],
  },
  {
    id: 'requests',
    label: 'Solicitudes activas',
    icon: 'assignment',
    roles: LAB_ADMIN,
  },
  {
    id: 'renters',
    label: 'Particulares',
    icon: 'handshake',
    roles: LAB_ADMIN,
  },
  { id: 'history', label: 'Historial', icon: 'history', roles: LAB_ADMIN },
  { id: 'metrics', label: 'Métricas', icon: 'bar-chart', roles: LAB_ADMIN },
  { id: 'reports', label: 'Generar reporte', icon: 'assessment', roles: LAB_ADMIN },
  { id: 'users', label: 'Usuarios', icon: 'group', roles: STAFF_ADMIN },
  { id: 'audit', label: 'Auditoría admins', icon: 'policy', roles: ['super_admin'] },
  { id: 'settings', label: 'Configuración', icon: 'settings', roles: STAFF_ADMIN },
  {
    id: 'profile',
    label: 'Perfil',
    icon: 'person-outline',
    roles: ['student', 'admin', 'super_admin', 'lab_manager', 'teacher', 'renter'],
  },
];

export function defaultSectionForRole(role: UserRole): WebSection {
  switch (role) {
    case 'student':
    case 'renter':
      return 'catalog';
    case 'teacher':
      return 'dashboard';
    case 'lab_manager':
      return 'requests';
    case 'admin':
    case 'super_admin':
      return 'dashboard';
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
  const { width, height } = useWindowDimensions();
  const compact = width < 900;

  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const navLabel =
    user.role === 'student'
      ? 'Espacio del alumno'
      : user.role === 'teacher'
        ? 'Supervisión académica'
        : user.role === 'renter'
          ? 'Renta de equipo'
          : user.role === 'super_admin' || user.role === 'admin'
            ? 'Administración'
            : 'Gestión del laboratorio';

  const navSpacing = React.useMemo(() => {
    // Para perfiles con pocas opciones (alumnos, profesores, particulares):
    // Se usan EXACTAMENTE las medidas y tamaños del commit a1409dd
    if (items.length <= 6) {
      return {
        sidebarPaddingTop: 28,
        sidebarPaddingBottom: 20,
        sidebarPaddingHorizontal: 18,
        logoSize: 42,
        logoMarginBottom: 22,
        logoPaddingHorizontal: 10,
        avatarSize: 36,
        userBoxPadding: 12,
        userBoxMarginBottom: 20,
        navLabelMarginBottom: 10,
        navLabelPaddingHorizontal: 11,
        listPaddingBottom: 12,
        itemPaddingVertical: 13,
        itemPaddingHorizontal: 12,
        itemGap: 4,
        iconSize: 22 as const,
        footerPaddingTop: 14,
        footerGap: 10,
        footerTextMarginBottom: 4,
      };
    }

    // Para administrador (11 o 12 secciones):
    // Se adapta suavemente entre la altura de una laptop (~640px-740px) y un monitor de escritorio (~900px-1080px)
    // De esta manera no se ve ni muy pequeño en pantallas grandes, ni desborda con scroll en laptop.
    const minH = 640;
    const maxH = 1050;
    const clampedH = Math.min(maxH, Math.max(minH, height));
    const factor = (clampedH - minH) / (maxH - minH);

    return {
      sidebarPaddingTop: Math.round(14 + factor * 14), // 14px a 28px
      sidebarPaddingBottom: Math.round(12 + factor * 8), // 12px a 20px
      sidebarPaddingHorizontal: Math.round(14 + factor * 4), // 14px a 18px
      logoSize: Math.round(38 + factor * 4), // 38px a 42px
      logoMarginBottom: Math.round(10 + factor * 12), // 10px a 22px
      logoPaddingHorizontal: Math.round(6 + factor * 4), // 6px a 10px
      avatarSize: Math.round(32 + factor * 4), // 32px a 36px
      userBoxPadding: Math.round(8 + factor * 4), // 8px a 12px
      userBoxMarginBottom: Math.round(10 + factor * 10), // 10px a 20px
      navLabelMarginBottom: Math.round(6 + factor * 4), // 6px a 10px
      navLabelPaddingHorizontal: Math.round(8 + factor * 3), // 8px a 11px
      listPaddingBottom: Math.round(6 + factor * 6), // 6px a 12px
      itemPaddingVertical: Math.round((7.5 + factor * 5.5) * 10) / 10, // 7.5px a 13px
      itemPaddingHorizontal: 12,
      itemGap: Math.round((2.5 + factor * 5.5) * 10) / 10, // 2.5px a 8px
      iconSize: (factor > 0.6 ? 22 : 20) as 22 | 20,
      footerPaddingTop: Math.round(10 + factor * 4), // 10px a 14px
      footerGap: Math.round(6 + factor * 4), // 6px a 10px
      footerTextMarginBottom: Math.round(2 + factor * 2), // 2px a 4px
    };
  }, [height, items.length]);

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      <View
        style={[
          styles.sidebar,
          compact && styles.sidebarCompact,
          {
            paddingTop: navSpacing.sidebarPaddingTop,
            paddingBottom: navSpacing.sidebarPaddingBottom,
            paddingHorizontal: navSpacing.sidebarPaddingHorizontal,
          },
        ]}
      >
        <View
          style={[
            styles.logoRow,
            {
              marginBottom: navSpacing.logoMarginBottom,
              paddingHorizontal: navSpacing.logoPaddingHorizontal,
            },
          ]}
        >
          <View
            style={[
              styles.logoMark,
              { width: navSpacing.logoSize, height: navSpacing.logoSize },
            ]}
          >
            <Text style={styles.logoText}>LT</Text>
          </View>
          {!compact ? (
            <View>
              <Text style={styles.brand}>Lab Topografía</Text>
              <Text style={styles.brandSub}>UAGro</Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.userBox,
            {
              padding: navSpacing.userBoxPadding,
              marginBottom: navSpacing.userBoxMarginBottom,
            },
          ]}
        >
          <Avatar initials={getInitials(user.displayName)} size={navSpacing.avatarSize} />
          {!compact ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.displayName}
              </Text>
              <Text style={styles.userRole}>{formatRole(user.role)}</Text>
            </View>
          ) : null}
        </View>

        {!compact ? (
          <Text
            style={[
              styles.navLabel,
              {
                marginBottom: navSpacing.navLabelMarginBottom,
                paddingHorizontal: navSpacing.navLabelPaddingHorizontal,
              },
            ]}
          >
            {navLabel}
          </Text>
        ) : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.navList,
            {
              gap: navSpacing.itemGap,
              paddingBottom: navSpacing.listPaddingBottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const active = item.id === section;
            return (
              <Pressable
                key={`${item.id}-${item.label}`}
                onPress={() => onSectionChange(item.id)}
                style={[
                  styles.navItem,
                  {
                    paddingVertical: navSpacing.itemPaddingVertical,
                    paddingHorizontal: navSpacing.itemPaddingHorizontal,
                  },
                  active && styles.navItemActive,
                ]}
              >
                <MaterialIcons
                  name={item.icon}
                  size={navSpacing.iconSize}
                  color={active ? '#fff' : theme.color.sidebarText}
                />
                {!compact ? (
                  <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingTop: navSpacing.footerPaddingTop,
              gap: navSpacing.footerGap,
            },
          ]}
        >
          {!compact ? (
            <Text
              style={[
                styles.footerText,
                { marginBottom: navSpacing.footerTextMarginBottom },
              ]}
            >
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
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sidebarCompact: {
    width: '100%',
    maxHeight: 240,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
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
    marginTop: 2,
    color: '#9EB1C7',
    fontSize: theme.font.size.sm,
  },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    marginBottom: 12,
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
    marginTop: 2,
    color: '#AFC0D4',
    fontSize: theme.font.size.sm,
  },
  navLabel: {
    paddingHorizontal: 8,
    marginBottom: 6,
    color: theme.color.sidebarMuted,
    fontSize: theme.font.size.xs,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  navList: {
    gap: 2.5,
    paddingBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
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
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    gap: 6,
  },
  footerText: {
    color: '#8197B0',
    fontSize: theme.font.size.sm,
    marginBottom: 2,
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
