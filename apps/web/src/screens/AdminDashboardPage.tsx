import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import { isAdminRole, type Loan } from '@lab-topo/domain';
import { watchEquipment, watchLabLoans, watchLabUsers } from '@lab-topo/services';
import { Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

export function AdminDashboardPage() {
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
    const rental = loans.filter((l) => l.loanType === 'rental').length;
    return { pending, delivered, overdue, rental, total: loans.length };
  }, [loans]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>
        {user?.role === 'super_admin' ? 'Superadministrador' : 'Administrador'}
      </Text>
      <Text style={styles.title}>Vista general</Text>
      <Text style={styles.subtitle}>
        Visibilidad total del laboratorio: catálogo, solicitudes, usuarios y movimientos.
      </Text>

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.kpis}>
          {[
            ['Equipos activos', equipmentCount],
            ['Usuarios', userCount],
            ['Solicitudes', kpis.total],
            ['Pendientes', kpis.pending],
            ['En préstamo', kpis.delivered],
            ['Retrasos', kpis.overdue],
            ['Rentas (total)', kpis.rental],
          ].map(([label, value]) => (
            <View key={label as string} style={styles.kpi}>
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={styles.kpiValue}>{value}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Qué puedes hacer aquí</Text>
        <Text style={styles.cardBody}>
          · Catálogo de equipos: inventariar y ajustar estados{'\n'}
          · Solicitudes: mismas acciones que el encargado + corregir aceptaciones/rechazos{'\n'}
          · Historial y métricas: demanda, escasez y tiempos{'\n'}
          · Usuarios: maestros, alumnos y particulares{'\n'}
          {user?.role === 'super_admin'
            ? '· Auditoría: revisar movimientos del otro administrador'
            : '· El superadministrador puede auditar tus cambios operativos'}
        </Text>
      </View>
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
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  kpi: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 96,
    padding: 16,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    ...theme.shadow.soft,
  },
  kpiLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  kpiValue: { marginTop: 12, color: theme.color.navy, fontSize: 28, fontWeight: '800' },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 18,
    ...theme.shadow.soft,
  },
  cardTitle: { color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.lg },
  cardBody: { marginTop: 10, color: theme.color.muted, fontSize: theme.font.size.md, lineHeight: 22 },
});
