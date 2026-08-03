import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import { isAdminRole, type Equipment, type Loan, type LoanType } from '@lab-topo/domain';
import { watchEquipment, watchLabLoans } from '@lab-topo/services';
import { Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

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

  const mostRequested = useMemo(() => {
    const map = new Map<string, { name: string; code: string; count: number }>();
    for (const loan of scopedLoans) {
      const cur = map.get(loan.equipmentId) ?? {
        name: loan.equipmentName,
        code: loan.equipmentCode,
        count: 0,
      };
      cur.count += 1;
      map.set(loan.equipmentId, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [scopedLoans]);

  const scarce = useMemo(() => {
    return equipment
      .filter((e) => e.active !== false)
      .map((e) => {
        const total = Math.max(1, e.qtyTotal || 1);
        const pressure = 1 - e.qtyAvailable / total;
        return {
          name: e.name,
          code: e.internalCode,
          available: e.qtyAvailable,
          total: e.qtyTotal,
          pressure,
        };
      })
      .sort((a, b) => b.pressure - a.pressure || a.available - b.available)
      .slice(0, 8);
  }, [equipment]);

  const deliveryTimes = useMemo(() => {
    const map = new Map<string, { name: string; code: string; hours: number[]; }>();
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
    return [...map.values()]
      .map((row) => ({
        name: row.name,
        code: row.code,
        avgHours: row.hours.reduce((a, b) => a + b, 0) / row.hours.length,
        samples: row.hours.length,
      }))
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [scopedLoans]);

  const slowest = deliveryTimes.slice(0, 5);
  const fastest = [...deliveryTimes].sort((a, b) => a.avgHours - b.avgHours).slice(0, 5);

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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Métricas del laboratorio</Text>
      <Text style={styles.subtitle}>
        Demanda, escasez y tiempos de atención. Filtra por periodo y tipo de préstamo.
      </Text>

      <View style={styles.filters}>
        {(
          [
            ['7d', '7 días'],
            ['30d', '30 días'],
            ['90d', '90 días'],
            ['all', 'Todo'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setPeriod(id)}
            style={[styles.chip, period === id && styles.chipActive]}
          >
            <Text style={[styles.chipText, period === id && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filters}>
        {(
          [
            ['all', 'Todos'],
            ['academic', 'Académico'],
            ['rental', 'Renta'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTypeFilter(id)}
            style={[styles.chip, typeFilter === id && styles.chipActive]}
          >
            <Text style={[styles.chipText, typeFilter === id && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.kpis}>
            {[
              ['Solicitudes', overview.total],
              ['Pendientes', overview.pending],
              ['En préstamo', overview.delivered],
              ['Devueltos', overview.returned],
              ['Rechazados', overview.rejected],
              ['Con retraso', overview.late],
            ].map(([label, value]) => (
              <View key={label as string} style={styles.kpi}>
                <Text style={styles.kpiLabel}>{label}</Text>
                <Text style={styles.kpiValue}>{value}</Text>
              </View>
            ))}
          </View>

          <Section title="Material más pedido">
            {mostRequested.length === 0 ? (
              <Text style={styles.empty}>Sin datos en el periodo.</Text>
            ) : (
              mostRequested.map((row, i) => (
                <RankRow
                  key={`${row.code}-${i}`}
                  rank={i + 1}
                  title={row.name}
                  subtitle={row.code}
                  value={`${row.count} sol.`}
                />
              ))
            )}
          </Section>

          <Section title="Material que más escasea">
            <Text style={styles.hint}>Según existencias actuales (disponible / total).</Text>
            {scarce.map((row, i) => (
              <RankRow
                key={`${row.code}-${i}`}
                rank={i + 1}
                title={row.name}
                subtitle={row.code}
                value={`${row.available}/${row.total} disp.`}
              />
            ))}
          </Section>

          <Section title="Tardan más en entregar">
            <Text style={styles.hint}>Promedio horas entre solicitud y entrega.</Text>
            {slowest.length === 0 ? (
              <Text style={styles.empty}>Aún no hay entregas con tiempo medible.</Text>
            ) : (
              slowest.map((row, i) => (
                <RankRow
                  key={`slow-${row.code}-${i}`}
                  rank={i + 1}
                  title={row.name}
                  subtitle={`${row.code} · ${row.samples} casos`}
                  value={`${row.avgHours.toFixed(1)} h`}
                />
              ))
            )}
          </Section>

          <Section title="Se entregan más rápido">
            {fastest.length === 0 ? (
              <Text style={styles.empty}>Aún no hay entregas con tiempo medible.</Text>
            ) : (
              fastest.map((row, i) => (
                <RankRow
                  key={`fast-${row.code}-${i}`}
                  rank={i + 1}
                  title={row.name}
                  subtitle={`${row.code} · ${row.samples} casos`}
                  value={`${row.avgHours.toFixed(1)} h`}
                />
              ))
            )}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function RankRow({
  rank,
  title,
  subtitle,
  value,
}: {
  rank: number;
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <View style={styles.rankRow}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankNum}>{rank}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rankTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rankSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={styles.rankValue}>{value}</Text>
    </View>
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  chipActive: { backgroundColor: theme.color.infoSoft, borderColor: theme.color.navy },
  chipText: { color: theme.color.muted, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: theme.color.navy },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 16 },
  kpi: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 88,
    padding: 14,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    ...theme.shadow.soft,
  },
  kpiLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  kpiValue: { marginTop: 10, color: theme.color.navy, fontSize: 26, fontWeight: '800' },
  section: {
    marginTop: 10,
    marginBottom: 18,
    padding: 16,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    ...theme.shadow.soft,
  },
  sectionTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 8,
  },
  hint: { color: theme.color.muted, fontSize: 12, marginBottom: 10 },
  empty: { color: theme.color.muted, fontSize: theme.font.size.md },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: { color: theme.color.navy, fontWeight: '800', fontSize: 12 },
  rankTitle: { color: theme.color.ink, fontWeight: '700', fontSize: theme.font.size.md },
  rankSub: { color: theme.color.muted, fontSize: 11, marginTop: 2 },
  rankValue: { color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.md },
});
