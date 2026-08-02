import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import type { WebSection } from '../layout/AppShell';
import { EquipmentPage } from './EquipmentPage';
import { RequestsPage } from './RequestsPage';

type DashboardHomeProps = {
  section: WebSection;
};

const SECTION_COPY: Record<WebSection, { title: string; description: string }> = {
  dashboard: {
    title: 'Inventario del laboratorio',
    description: 'Control de equipos, préstamos y devoluciones.',
  },
  equipment: {
    title: 'Catálogo de equipos',
    description: 'Alta, edición y estados del inventario.',
  },
  requests: {
    title: 'Solicitudes activas',
    description: 'Revisa y autoriza los préstamos solicitados.',
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
  if (section === 'equipment') {
    return <EquipmentPage />;
  }

  if (section === 'requests') {
    return <RequestsPage />;
  }

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
    padding: 30,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 25,
  },
  title: {
    color: theme.color.navy,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 7,
    color: theme.color.muted,
    fontSize: 12,
  },
  kpis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 21,
  },
  kpi: {
    flexGrow: 1,
    flexBasis: 160,
    minHeight: 112,
    padding: 17,
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
    fontSize: 10,
  },
  kpiLabelAlert: {
    color: '#FFE2E7',
  },
  kpiValue: {
    marginTop: 14,
    color: theme.color.navy,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -1,
  },
  kpiValueAlert: {
    color: '#fff',
  },
  kpiTrend: {
    marginTop: 4,
    color: theme.color.success,
    fontSize: 9,
  },
  kpiTrendAlert: {
    color: '#FFD5DC',
  },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 21,
    ...theme.shadow.soft,
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardBody: {
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
