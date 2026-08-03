import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import { isAdminRole, type Loan } from '@lab-topo/domain';
import { watchEquipment, watchLabLoans, watchLabUsers } from '@lab-topo/services';
import { Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { BarChart, StackedBar } from '../components/BarChart';
import type { WebSection } from '../layout/AppShell';

type AdminDashboardPageProps = {
  onNavigate?: (section: WebSection) => void;
};

export function AdminDashboardPage({ onNavigate }: AdminDashboardPageProps) {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [equipmentCount, setEquipmentCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return;
    let a = false;
    let b = false;
    let c = false;
    const done = () => {
      if (a && b && c) setLoading(false);
    };

    const u1 = watchLabLoans(
      user.labId,
      (next) => {
        setLoans(next);
        a = true;
        done();
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    const u2 = watchEquipment(
      (next) => {
        setEquipmentCount(next.filter((e) => e.active !== false).length);
        b = true;
        done();
      },
      () => {
        b = true;
        done();
      }
    );
    const u3 = watchLabUsers(
      (next) => {
        setUserCount(next.length);
        c = true;
        done();
      },
      () => {
        c = true;
        done();
      },
      user.labId
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user]);

  const kpis = useMemo(() => {
    const pending = loans.filter((l) => l.status === 'pending').length;
    const delivered = loans.filter((l) => l.status === 'delivered').length;
    const overdue = loans.filter(
      (l) => l.status === 'delivered' && l.dueAt && new Date(l.dueAt).getTime() < Date.now()
    ).length;
    const rejected = loans.filter((l) => l.status === 'rejected').length;
    const returned = loans.filter(
      (l) => l.status === 'returned' || l.status === 'returned_late'
    ).length;
    const rental = loans.filter((l) => l.loanType === 'rental').length;
    return { pending, delivered, overdue, rejected, returned, rental, total: loans.length };
  }, [loans]);

  const topRequested = useMemo(() => {
    const map = new Map<string, { label: string; sublabel: string; value: number }>();
    for (const loan of loans) {
      const cur = map.get(loan.equipmentId) ?? {
        label: loan.equipmentName,
        sublabel: loan.equipmentCode,
        value: 0,
      };
      cur.value += 1;
      map.set(loan.equipmentId, cur);
    }
    return [...map.entries()]
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [loans]);

  const statusSegments = [
    { id: 'pending', label: 'Pendientes', value: kpis.pending, color: '#E8A317' },
    { id: 'delivered', label: 'En préstamo', value: kpis.delivered, color: '#7463BD' },
    { id: 'returned', label: 'Devueltos', value: kpis.returned, color: '#16855B' },
    { id: 'rejected', label: 'Rechazados', value: kpis.rejected, color: '#D90429' },
    { id: 'overdue', label: 'Retrasos', value: kpis.overdue, color: '#19315F' },
  ];

  const shortcuts: Array<{
    section: WebSection;
    icon: React.ComponentProps<typeof MaterialIcons>['name'];
    title: string;
    hint: string;
    tone?: 'alert' | 'info';
  }> = [
    {
      section: 'requests',
      icon: 'assignment',
      title: 'Solicitudes',
      hint: `${kpis.pending} pendientes · ${kpis.overdue} retrasos`,
      tone: kpis.pending || kpis.overdue ? 'alert' : 'info',
    },
    {
      section: 'equipment',
      icon: 'inventory-2',
      title: 'Catálogo',
      hint: `${equipmentCount} equipos activos`,
    },
    {
      section: 'history',
      icon: 'history',
      title: 'Historial',
      hint: `${kpis.total} movimientos`,
    },
    {
      section: 'metrics',
      icon: 'bar-chart',
      title: 'Métricas',
      hint: 'Demanda, escasez y tiempos',
    },
    {
      section: 'users',
      icon: 'group',
      title: 'Usuarios',
      hint: `${userCount} cuentas`,
    },
    ...(user?.role === 'super_admin'
      ? [
          {
            section: 'audit' as WebSection,
            icon: 'policy' as const,
            title: 'Auditoría',
            hint: 'Movimientos del otro admin',
          },
        ]
      : []),
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>
        {user?.role === 'super_admin' ? 'Superadministrador' : 'Administrador'}
      </Text>
      <Text style={styles.title}>Vista general</Text>
      <Text style={styles.subtitle}>
        Resumen operativo y accesos rápidos al resto del panel.
      </Text>

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : (
        <>
          {(kpis.pending > 0 || kpis.overdue > 0) && (
            <Pressable
              style={styles.alertBanner}
              onPress={() => onNavigate?.('requests')}
            >
              <MaterialIcons name="warning-amber" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>Atención requerida</Text>
                <Text style={styles.alertBody}>
                  {kpis.pending} solicitud(es) pendiente(s)
                  {kpis.overdue ? ` · ${kpis.overdue} préstamo(s) con retraso` : ''}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#fff" />
            </Pressable>
          )}

          <View style={styles.kpis}>
            {[
              { label: 'Equipos', value: equipmentCount, icon: 'precision-manufacturing' as const },
              { label: 'Usuarios', value: userCount, icon: 'people' as const },
              { label: 'Pendientes', value: kpis.pending, icon: 'hourglass-top' as const },
              { label: 'En préstamo', value: kpis.delivered, icon: 'local-shipping' as const },
              { label: 'Retrasos', value: kpis.overdue, icon: 'timer-off' as const },
              { label: 'Rentas', value: kpis.rental, icon: 'handshake' as const },
            ].map((kpi) => (
              <View key={kpi.label} style={styles.kpi}>
                <View style={styles.kpiIcon}>
                  <MaterialIcons name={kpi.icon} size={18} color={theme.color.navy} />
                </View>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Distribución de movimientos</Text>
            <StackedBar segments={statusSegments} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Material más solicitado</Text>
            <BarChart
              data={topRequested}
              unit="sol."
              emptyText="Aún no hay suficientes solicitudes para graficar."
            />
          </View>

          <Text style={styles.sectionLabel}>Accesos rápidos</Text>
          <View style={styles.shortcuts}>
            {shortcuts.map((item) => (
              <Pressable
                key={item.section}
                style={[styles.shortcut, item.tone === 'alert' && styles.shortcutAlert]}
                onPress={() => onNavigate?.(item.section)}
              >
                <View
                  style={[
                    styles.shortcutIcon,
                    item.tone === 'alert' && styles.shortcutIconAlert,
                  ]}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={20}
                    color={item.tone === 'alert' ? theme.color.red : theme.color.navy}
                  />
                </View>
                <Text style={styles.shortcutTitle}>{item.title}</Text>
                <Text style={styles.shortcutHint}>{item.hint}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 28, paddingBottom: 48 },
  eyebrow: {
    color: theme.color.red,
    fontSize: theme.font.size.sm,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: { marginTop: 8, marginBottom: 18, color: theme.color.muted, fontSize: theme.font.size.md },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.color.red,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  alertTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  alertBody: { color: '#FFD5DC', marginTop: 2, fontSize: 12 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpi: {
    flexGrow: 1,
    flexBasis: 130,
    minHeight: 100,
    padding: 14,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    ...theme.shadow.soft,
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  kpiValue: { marginTop: 6, color: theme.color.navy, fontSize: 26, fontWeight: '800' },
  panel: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 14,
    ...theme.shadow.soft,
  },
  panelTitle: {
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: theme.font.size.lg,
    marginBottom: 12,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 10,
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shortcut: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 150,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 14,
    ...theme.shadow.soft,
  },
  shortcutAlert: { borderColor: '#f3c9d0', backgroundColor: theme.color.redSoft },
  shortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  shortcutIconAlert: { backgroundColor: '#fff' },
  shortcutTitle: { color: theme.color.navy, fontWeight: '800', fontSize: 15 },
  shortcutHint: { marginTop: 4, color: theme.color.muted, fontSize: 12 },
});
