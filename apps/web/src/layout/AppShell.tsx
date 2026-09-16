import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
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
  const isMobile = width < 860;
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isMobile && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [isMobile, drawerOpen]);

  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const currentItem = items.find((i) => i.id === section);
  const currentSectionLabel = currentItem?.label || 'Laboratorio';

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

    // Para administrador (11 o 12 secciones) en escritorio:
    const minH = 640;
    const maxH = 1050;
    const clampedH = Math.min(maxH, Math.max(minH, height));
    const factor = (clampedH - minH) / (maxH - minH);

    return {
      sidebarPaddingTop: Math.round(14 + factor * 14),
      sidebarPaddingBottom: Math.round(12 + factor * 8),
      sidebarPaddingHorizontal: Math.round(14 + factor * 4),
      logoSize: Math.round(38 + factor * 4),
      logoMarginBottom: Math.round(10 + factor * 12),
      logoPaddingHorizontal: Math.round(6 + factor * 4),
      avatarSize: Math.round(32 + factor * 4),
      userBoxPadding: Math.round(8 + factor * 4),
      userBoxMarginBottom: Math.round(10 + factor * 10),
      navLabelMarginBottom: Math.round(6 + factor * 4),
      navLabelPaddingHorizontal: Math.round(8 + factor * 3),
      listPaddingBottom: Math.round(6 + factor * 6),
      itemPaddingVertical: Math.round((7.5 + factor * 5.5) * 10) / 10,
      itemPaddingHorizontal: 12,
      itemGap: Math.round((2.5 + factor * 5.5) * 10) / 10,
      iconSize: (factor > 0.6 ? 22 : 20) as 22 | 20,
      footerPaddingTop: Math.round(10 + factor * 4),
      footerGap: Math.round(6 + factor * 4),
      footerTextMarginBottom: Math.round(2 + factor * 2),
    };
  }, [height, items.length]);

  return (
    <View style={[styles.shell, isMobile && styles.shellMobile]}>
      {/* Header superior visible únicamente en pantallas móviles */}
      {isMobile ? (
        <View style={styles.mobileHeader}>
          <View style={styles.mobileHeaderLeft}>
            <View style={styles.mobileLogoMark}>
              <Text style={styles.mobileLogoText}>LT</Text>
            </View>
            <View style={styles.mobileHeaderTitles}>
              <Text style={styles.mobileHeaderBrand} numberOfLines={1}>
                Lab Topografía
              </Text>
              <Text style={styles.mobileHeaderSection} numberOfLines={1}>
                {currentSectionLabel}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.hamburgerBtn,
              pressed && styles.hamburgerBtnPressed,
            ]}
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú de navegación"
          >
            <MaterialIcons name="menu" size={26} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      {/* Sidebar fijo en escritorio (oculto en móvil) */}
      {!isMobile ? (
        <View
          style={[
            styles.sidebar,
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
            <View>
              <Text style={styles.brand}>Lab Topografía</Text>
              <Text style={styles.brandSub}>UAGro</Text>
            </View>
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
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.displayName}
              </Text>
              <Text style={styles.userRole}>{formatRole(user.role)}</Text>
            </View>
          </View>

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
                  <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
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
            <Text
              style={[
                styles.footerText,
                { marginBottom: navSpacing.footerTextMarginBottom },
              ]}
            >
              Sesión: <Text style={styles.footerBold}>{formatRole(user.role)}</Text>
            </Text>
            <Button title="Cerrar sesión" variant="secondary" onPress={() => logout()} />
          </View>
        </View>
      ) : null}

      {/* Contenedor principal de contenido */}
      <View style={styles.main}>{children}</View>

      {/* Drawer lateral deslizable a la derecha para móvil */}
      {isMobile ? (
        <Modal
          visible={drawerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDrawerOpen(false)}
        >
          <View style={styles.drawerBackdrop}>
            {/* Tocar el fondo oscuro cierra el menú */}
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => setDrawerOpen(false)}
              accessibilityLabel="Cerrar menú"
            />
            {/* Panel lateral derecho */}
            <View style={styles.drawerPanel}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerLogoRow}>
                  <View style={styles.drawerLogoMark}>
                    <Text style={styles.drawerLogoText}>LT</Text>
                  </View>
                  <View>
                    <Text style={styles.brandDrawer}>Lab Topografía</Text>
                    <Text style={styles.brandSubDrawer}>UAGro</Text>
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.closeBtn,
                    pressed && styles.closeBtnPressed,
                  ]}
                  onPress={() => setDrawerOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar menú"
                >
                  <MaterialIcons name="close" size={24} color="#fff" />
                </Pressable>
              </View>

              <View style={styles.userBox}>
                <Avatar initials={getInitials(user.displayName)} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.displayName}
                  </Text>
                  <Text style={styles.userRole}>{formatRole(user.role)}</Text>
                </View>
              </View>

              <Text style={styles.navLabel}>{navLabel}</Text>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.drawerNavList}
                showsVerticalScrollIndicator={false}
              >
                {items.map((item) => {
                  const active = item.id === section;
                  return (
                    <Pressable
                      key={`drawer-${item.id}-${item.label}`}
                      onPress={() => {
                        onSectionChange(item.id);
                        setDrawerOpen(false);
                      }}
                      style={[styles.navItem, active && styles.navItemActive]}
                    >
                      <MaterialIcons
                        name={item.icon}
                        size={22}
                        color={active ? '#fff' : theme.color.sidebarText}
                      />
                      <Text style={[styles.navText, active && styles.navTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.drawerFooter}>
                <Text style={styles.footerText}>
                  Sesión: <Text style={styles.footerBold}>{formatRole(user.role)}</Text>
                </Text>
                <Button
                  title="Cerrar sesión"
                  variant="secondary"
                  onPress={() => {
                    setDrawerOpen(false);
                    logout();
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100%' as unknown as number,
    backgroundColor: theme.color.canvas,
    width: '100%',
    maxWidth: '100%',
  },
  shellMobile: {
    flexDirection: 'column',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  sidebar: {
    width: 280,
    backgroundColor: theme.color.navy,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    backgroundColor: theme.color.navy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 10,
    width: '100%',
  },
  mobileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  mobileLogoMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mobileLogoText: {
    color: theme.color.navy,
    fontWeight: '900',
    fontSize: 16,
  },
  mobileHeaderTitles: {
    flex: 1,
    minWidth: 0,
  },
  mobileHeaderBrand: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  mobileHeaderSection: {
    color: '#9EB1C7',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  hamburgerBtn: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  hamburgerBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerPanel: {
    width: '84%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: theme.color.navy,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    marginBottom: 16,
    width: '100%',
  },
  drawerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  drawerLogoMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  drawerLogoText: {
    color: theme.color.navy,
    fontWeight: '900',
    fontSize: 15,
  },
  brandDrawer: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  brandSubDrawer: {
    color: '#9EB1C7',
    fontSize: 12,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  drawerNavList: {
    gap: 6,
    paddingBottom: 16,
  },
  drawerFooter: {
    marginTop: 'auto' as unknown as number,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    gap: 8,
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
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
});

