import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import type { WebSection } from '../layout/AppShell';
import { EquipmentPage } from './EquipmentPage';
import { ProfilePage } from './ProfilePage';
import { RequestsPage } from './RequestsPage';
import { StudentCatalogPage } from './StudentCatalogPage';
import { StudentRequestsPage } from './StudentRequestsPage';

type DashboardHomeProps = {
  section: WebSection;
};

const SECTION_COPY: Record<
  Exclude<WebSection, 'equipment' | 'requests' | 'catalog' | 'studentRequests' | 'profile'>,
  { title: string; description: string }
> = {
  dashboard: {
    title: 'Inventario del laboratorio',
    description: 'Control de equipos, préstamos y devoluciones.',
  },
  history: {
    title: 'Historial',
    description: 'Movimientos auditables del laboratorio.',
  },
  metrics: {
    title: 'Métricas',
    description: 'Indicadores operativos del laboratorio.',
  },
  users: {
    title: 'Usuarios',
    description: 'Administración de cuentas y roles.',
  },
  settings: {
    title: 'Configuración',
    description: 'Políticas del laboratorio y parámetros del sistema.',
  },
};

export function SectionPage({ section }: DashboardHomeProps) {
  if (section === 'equipment') return <EquipmentPage />;
  if (section === 'requests') return <RequestsPage />;
  if (section === 'catalog') return <StudentCatalogPage />;
  if (section === 'studentRequests') return <StudentRequestsPage />;
  if (section === 'profile') return <ProfilePage />;

  const copy = SECTION_COPY[section];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.description}</Text>
      </View>

      {section === 'dashboard' ? (
        <View style={styles.kpis}>
          {[
            { label: 'Solicitudes pendientes', value: '—', alert: false },
            { label: 'Equipos en préstamo', value: '—', alert: false },
            { label: 'Devoluciones hoy', value: '—', alert: false },
            { label: 'Alertas por retraso', value: '—', alert: true },
          ].map((kpi) => (
            <View key={kpi.label} style={[styles.kpi, kpi.alert && styles.kpiAlert]}>
              <Text style={[styles.kpiLabel, kpi.alert && styles.kpiLabelAlert]}>{kpi.label}</Text>
              <Text style={[styles.kpiValue, kpi.alert && styles.kpiValueAlert]}>{kpi.value}</Text>
              <Text style={[styles.kpiTrend, kpi.alert && styles.kpiTrendAlert]}>
                Módulo de préstamos pendiente
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Módulo en construcción</Text>
        <Text style={styles.cardBody}>
          Esta sección se implementará en el siguiente módulo. El catálogo de equipos ya está
          disponible en el menú lateral.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvas,
  },
  content: {
    padding: 32,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
  },
  kpis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  kpi: {
    flexGrow: 1,
    flexBasis: 180,
    minHeight: 120,
    padding: 18,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    ...theme.shadow.soft,
  },
  kpiAlert: {
    backgroundColor: theme.color.red,
    borderColor: theme.color.red,
  },
  kpiLabel: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },
  kpiLabelAlert: {
    color: '#FFE2E7',
  },
  kpiValue: {
    marginTop: 14,
    color: theme.color.navy,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  kpiValueAlert: {
    color: '#fff',
  },
  kpiTrend: {
    marginTop: 6,
    color: theme.color.success,
    fontSize: theme.font.size.sm,
  },
  kpiTrendAlert: {
    color: '#FFD5DC',
  },
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
  cardBody: {
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    lineHeight: 22,
  },
});
