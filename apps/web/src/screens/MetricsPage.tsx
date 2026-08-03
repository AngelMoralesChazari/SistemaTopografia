import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import { isAdminRole, type Equipment, type Loan, type LoanType } from '@lab-topo/domain';
import { watchEquipment, watchLabLoans } from '@lab-topo/services';
import { Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { BarChart, StackedBar } from '../components/BarChart';
import { FilterChips } from '../components/FilterChips';

type Period = '7d' | '30d' | '90d' | 'all';
type TypeFilter = 'all' | LoanType;

function msForPeriod(period: Period): number | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return days * 24 * 60 * 60 * 1000;
}

function hoursBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const t0 = new Date(a).getTime();
  const t1 = new Date(b).getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1) || t1 < t0) return null;
  return (t1 - t0) / (1000 * 60 * 60);
}

export function MetricsPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    if (!user || (!isAdminRole(user.role) && user.role !== 'lab_manager')) return;
    let loansReady = false;
    let eqReady = false;
    const done = () => {
      if (loansReady && eqReady) setLoading(false);
    };

    const u1 = watchLabLoans(
      user.labId,
      (next) => {
        setLoans(next);
        loansReady = true;
        setError(null);
        done();
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    const u2 = watchEquipment(
      (next) => {
        setEquipment(next);
        eqReady = true;
        done();
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => {
      u1();
      u2();
    };
  }, [user]);

  const scopedLoans = useMemo(() => {
    const windowMs = msForPeriod(period);
    const from = windowMs ? Date.now() - windowMs : 0;
    return loans.filter((loan) => {
      if (typeFilter !== 'all' && loan.loanType !== typeFilter) return false;
      if (!windowMs) return true;
      const t = loan.requestedAt ? new Date(loan.requestedAt).getTime() : 0;
      return t >= from;
    });
  }, [loans, period, typeFilter]);

  const overview = useMemo(() => {
    const pending = scopedLoans.filter((l) => l.status === 'pending').length;
    const delivered = scopedLoans.filter((l) => l.status === 'delivered').length;
    const returned = scopedLoans.filter(
      (l) => l.status === 'returned' || l.status === 'returned_late'
    ).length;
    const rejected = scopedLoans.filter((l) => l.status === 'rejected').length;
    const late = scopedLoans.filter((l) => l.status === 'returned_late').length;
    return { total: scopedLoans.length, pending, delivered, returned, rejected, late };
  }, [scopedLoans]);

  const mostRequested = useMemo(() => {
    const map = new Map<string, { label: string; sublabel: string; value: number }>();
    for (const loan of scopedLoans) {
      const cur = map.get(loan.equipmentId) ?? {
        label: loan.equipmentName,
        sublabel: loan.equipmentCode,
        value: 0,
      };
      cur.value += 1;
      map.set(loan.equipmentId, cur);
    }
    return [...map.entries()]
      .map(([id, row]) => ({ id, ...row, color: theme.color.navy }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [scopedLoans]);

  const scarce = useMemo(() => {
    return equipment
      .filter((e) => e.active !== false)
      .map((e) => {
        const total = Math.max(1, e.qtyTotal || 1);
        const used = total - e.qtyAvailable;
        return {
          id: e.id,
          label: e.name,
          sublabel: `${e.internalCode} · ${e.qtyAvailable}/${e.qtyTotal} disp.`,
          value: used / total,
          display: Math.round((used / total) * 100),
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        label: row.label,
        sublabel: row.sublabel,
        value: row.display,
        color: '#A76A00',
      }));
  }, [equipment]);

  const deliveryTimes = useMemo(() => {
    const map = new Map<string, { name: string; code: string; hours: number[] }>();
    for (const loan of scopedLoans) {
      const h = hoursBetween(loan.requestedAt, loan.deliveredAt);
      if (h == null) continue;
      const cur = map.get(loan.equipmentId) ?? {
        name: loan.equipmentName,
        code: loan.equipmentCode,
        hours: [] as number[],
      };
      cur.hours.push(h);
      map.set(loan.equipmentId, cur);
    }
    return [...map.entries()].map(([id, row]) => ({
      id,
      label: row.name,
      sublabel: `${row.code} · ${row.hours.length} casos`,
      value: row.hours.reduce((a, b) => a + b, 0) / row.hours.length,
    }));
  }, [scopedLoans]);

  const slowest = [...deliveryTimes].sort((a, b) => b.value - a.value).slice(0, 6);
  const fastest = [...deliveryTimes].sort((a, b) => a.value - b.value).slice(0, 6);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Métricas del laboratorio</Text>
      <Text style={styles.subtitle}>
        Demanda, escasez y tiempos de atención — con gráficas filtrables.
      </Text>

      <FilterChips
        label="Periodo"
        value={period}
        onChange={setPeriod}
        options={[
          { id: '7d', label: '7 días' },
          { id: '30d', label: '30 días' },
          { id: '90d', label: '90 días' },
          { id: 'all', label: 'Todo' },
        ]}
      />
      <FilterChips
        label="Tipo de préstamo"
        value={typeFilter}
        onChange={setTypeFilter}
        options={[
          { id: 'all', label: 'Todos' },
          { id: 'academic', label: 'Académico' },
          { id: 'rental', label: 'Renta' },
        ]}
      />

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Volumen del periodo · {overview.total} solicitudes</Text>
            <StackedBar
              segments={[
                { id: 'pending', label: 'Pendientes', value: overview.pending, color: '#E8A317' },
                { id: 'delivered', label: 'En préstamo', value: overview.delivered, color: '#7463BD' },
                { id: 'returned', label: 'Devueltos', value: overview.returned, color: '#16855B' },
                { id: 'rejected', label: 'Rechazados', value: overview.rejected, color: '#D90429' },
                { id: 'late', label: 'Con retraso', value: overview.late, color: '#19315F' },
              ]}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Material más pedido</Text>
            <BarChart data={mostRequested} unit="sol." emptyText="Sin solicitudes en el periodo." />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Material que más escasea</Text>
            <Text style={styles.hint}>Porcentaje de stock ocupado (no disponible).</Text>
            <BarChart data={scarce} unit="%" emptyText="Sin equipos en inventario." />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Tardan más en entregar</Text>
            <Text style={styles.hint}>Promedio de horas entre solicitud y entrega.</Text>
            <BarChart
              data={slowest.map((r) => ({ ...r, color: '#D90429' }))}
              unit="h"
              emptyText="Aún no hay entregas con tiempo medible."
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Se entregan más rápido</Text>
            <BarChart
              data={fastest.map((r) => ({ ...r, color: '#16855B' }))}
              unit="h"
              emptyText="Aún no hay entregas con tiempo medible."
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 28, paddingBottom: 48 },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: { marginTop: 8, marginBottom: 16, color: theme.color.muted, fontSize: theme.font.size.md },
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
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 10,
  },
  hint: { color: theme.color.muted, fontSize: 12, marginBottom: 10 },
});
