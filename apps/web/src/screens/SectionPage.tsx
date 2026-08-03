import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import { isAdminRole } from '@lab-topo/domain';
import { useAuth } from '../auth/AuthContext';
import type { WebSection } from '../layout/AppShell';
import { AdminAuditPage } from './AdminAuditPage';
import { AdminDashboardPage } from './AdminDashboardPage';
import { EquipmentPage } from './EquipmentPage';
import { HistoryPage } from './HistoryPage';
import { MetricsPage } from './MetricsPage';
import { ProfilePage } from './ProfilePage';
import { RequestsPage } from './RequestsPage';
import { RentersPage } from './RentersPage';
import { StudentCatalogPage } from './StudentCatalogPage';
import { StudentRequestsPage } from './StudentRequestsPage';
import { TeacherDashboardPage } from './TeacherDashboardPage';
import { TeacherStudentsPage } from './TeacherStudentsPage';
import { UsersPage } from './UsersPage';

type DashboardHomeProps = {
  section: WebSection;
  onSectionChange?: (section: WebSection) => void;
};

export function SectionPage({ section, onSectionChange }: DashboardHomeProps) {
  const { user } = useAuth();

  if (section === 'equipment') return <EquipmentPage />;
  if (section === 'requests') return <RequestsPage />;
  if (section === 'renters') return <RentersPage />;
  if (section === 'catalog') return <StudentCatalogPage />;
  if (section === 'studentRequests') return <StudentRequestsPage />;
  if (section === 'teacherStudents') return <TeacherStudentsPage />;
  if (section === 'profile') return <ProfilePage />;
  if (section === 'history') return <HistoryPage />;
  if (section === 'metrics') return <MetricsPage />;
  if (section === 'users') return <UsersPage />;
  if (section === 'audit') return <AdminAuditPage />;
  if (section === 'dashboard' && user?.role === 'teacher') {
    return <TeacherDashboardPage />;
  }
  if (section === 'dashboard' && user && isAdminRole(user.role)) {
    return <AdminDashboardPage onNavigate={onSectionChange} />;
  }
  if (section === 'dashboard') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Inventario del laboratorio</Text>
          <Text style={styles.subtitle}>Usa el menú para solicitudes, catálogo e historial.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Panel del encargado</Text>
          <Text style={styles.cardBody}>
            Revisa solicitudes activas, gestiona el catálogo y aprueba particulares desde el menú
            lateral.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Configuración</Text>
        <Text style={styles.subtitle}>Políticas del laboratorio y parámetros del sistema.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Módulo en construcción</Text>
        <Text style={styles.cardBody}>
          La configuración avanzada del laboratorio se completará en un siguiente paso.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 32, paddingBottom: 48 },
  header: { marginBottom: 24 },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: { marginTop: 8, color: theme.color.muted, fontSize: theme.font.size.md },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 22,
    ...theme.shadow.soft,
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardBody: { color: theme.color.muted, fontSize: theme.font.size.md, lineHeight: 22 },
});
