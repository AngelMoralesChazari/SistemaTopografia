import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '@lab-topo/config';
import {
  isAdminRole,
  loanStatusLabel,
  type Loan,
  type LoanStatus,
  type LoanType,
} from '@lab-topo/domain';
import { watchLabLoans } from '@lab-topo/services';
import { Badge, Notice, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

function toneForStatus(status: LoanStatus): BadgeTone {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'delivered':
      return 'delivered';
    case 'returned_late':
    case 'damaged':
    case 'lost':
      return 'late';
    default:
      return 'ok';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type StatusFilter = 'all' | LoanStatus;
type TypeFilter = 'all' | LoanType;

export function HistoryPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [queryText, setQueryText] = useState('');

  useEffect(() => {
    if (!user || (!isAdminRole(user.role) && user.role !== 'lab_manager')) return;
    const unsub = watchLabLoans(
      user.labId,
      (next) => {
        setLoans(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return loans.filter((loan) => {
      if (statusFilter !== 'all' && loan.status !== statusFilter) return false;
      if (typeFilter !== 'all' && loan.loanType !== typeFilter) return false;
      if (!q) return true;
      const hay = [
        loan.folio,
        loan.equipmentName,
        loan.equipmentCode,
        loan.studentName,
        loan.teacherName,
        loan.approvedBy ?? '',
        loan.deliveredBy ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [loans, statusFilter, typeFilter, queryText]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Historial de movimientos</Text>
      <Text style={styles.subtitle}>
        Quién pidió, qué material, quién aprobó/entregó y estado actual.
      </Text>

      <View style={styles.filters}>
        {(
          [
            ['all', 'Todos'],
            ['pending', 'Pendiente'],
            ['approved', 'Aprobada'],
            ['rejected', 'Rechazada'],
            ['delivered', 'Entregado'],
            ['returned', 'Devuelto'],
            ['returned_late', 'Con retraso'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setStatusFilter(id)}
            style={[styles.chip, statusFilter === id && styles.chipActive]}
          >
            <Text style={[styles.chipText, statusFilter === id && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filters}>
        {(
          [
            ['all', 'Académico y renta'],
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

      <TextInput
        value={queryText}
        onChangeText={setQueryText}
        placeholder="Buscar folio, equipo, alumno, maestro…"
        placeholderTextColor={theme.color.muted}
        style={styles.search}
      />

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <Notice title="Sin movimientos" description="No hay préstamos con esos filtros." />
      ) : (
        filtered.map((loan) => (
          <View key={loan.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.folio}>#{loan.folio}</Text>
              <Badge label={loanStatusLabel(loan.status)} tone={toneForStatus(loan.status)} />
            </View>
            <Text style={styles.equip}>{loan.equipmentName}</Text>
            <Text style={styles.meta}>
              {loan.loanType === 'rental' ? 'Renta' : 'Académico'} · {loan.equipmentCode}
            </Text>
            <View style={styles.grid}>
              <Meta label="Solicitó" value={loan.studentName} />
              <Meta label="Profesor / lab" value={loan.teacherName || '—'} />
              <Meta label="Solicitada" value={formatDate(loan.requestedAt)} />
              <Meta label="Entrega" value={formatDate(loan.deliveredAt)} />
              <Meta label="Devolución" value={formatDate(loan.returnedAt)} />
              <Meta
                label="Gestión (IDs)"
                value={[loan.approvedBy, loan.deliveredBy, loan.returnedBy].filter(Boolean).join(' · ') || '—'}
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
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
  search: {
    height: 44,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
    color: theme.color.ink,
    fontSize: theme.font.size.md,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.soft,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  folio: { color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.md },
  equip: { marginTop: 8, color: theme.color.ink, fontWeight: '700', fontSize: theme.font.size.lg },
  meta: { marginTop: 4, color: theme.color.muted, fontSize: theme.font.size.sm },
  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexGrow: 1, flexBasis: 160, minWidth: 140 },
  metaLabel: { color: theme.color.muted, fontSize: 11, fontWeight: '700' },
  metaValue: { color: theme.color.ink, fontSize: theme.font.size.sm, fontWeight: '600' },
});
