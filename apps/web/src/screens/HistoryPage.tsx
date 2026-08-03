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
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import {
  isAdminRole,
  loanStatusLabel,
  type AppUser,
  type Loan,
  type LoanStatus,
  type LoanType,
} from '@lab-topo/domain';
import { watchLabLoans, watchLabUsers } from '@lab-topo/services';
import { Badge, Notice, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { FilterChips } from '../components/FilterChips';
import { ListPagination } from '../components/ListPagination';
import { paginate } from '../lib/pagination';

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

function resolveActor(uid: string | null | undefined, usersById: Map<string, AppUser>): string {
  if (!uid) return '—';
  return usersById.get(uid)?.displayName ?? 'Personal del lab';
}

export function HistoryPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [queryText, setQueryText] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || (!isAdminRole(user.role) && user.role !== 'lab_manager')) return;
    let loansReady = false;
    let usersReady = false;
    const done = () => {
      if (loansReady && usersReady) setLoading(false);
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

    const u2 = watchLabUsers(
      (next) => {
        setUsers(next);
        usersReady = true;
        done();
      },
      () => {
        usersReady = true;
        done();
      },
      user.labId
    );

    return () => {
      u1();
      u2();
    };
  }, [user]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [statusFilter, typeFilter, queryText]);

  const usersById = useMemo(() => {
    const map = new Map<string, AppUser>();
    for (const u of users) map.set(u.uid, u);
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return loans.filter((loan) => {
      if (statusFilter !== 'all' && loan.status !== statusFilter) return false;
      if (typeFilter !== 'all' && loan.loanType !== typeFilter) return false;
      if (!q) return true;
      const managerNames = [
        resolveActor(loan.approvedBy, usersById),
        resolveActor(loan.deliveredBy, usersById),
        resolveActor(loan.returnedBy, usersById),
      ].join(' ');
      const hay = [
        loan.folio,
        loan.equipmentName,
        loan.equipmentCode,
        loan.studentName,
        loan.teacherName,
        managerNames,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [loans, statusFilter, typeFilter, queryText, usersById]);

  const paging = useMemo(() => paginate(filtered, page), [filtered, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Historial de movimientos</Text>
      <Text style={styles.subtitle}>
        Lista compacta: toca una fila para ver el detalle completo.
      </Text>

      <FilterChips
        label="Estado"
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { id: 'all', label: 'Todos' },
          { id: 'pending', label: 'Pendiente' },
          { id: 'approved', label: 'Aprobada' },
          { id: 'rejected', label: 'Rechazada' },
          { id: 'delivered', label: 'Entregado' },
          { id: 'returned', label: 'Devuelto' },
          { id: 'returned_late', label: 'Con retraso' },
        ]}
      />

      <FilterChips
        label="Tipo"
        value={typeFilter}
        onChange={setTypeFilter}
        options={[
          { id: 'all', label: 'Académico y renta' },
          { id: 'academic', label: 'Académico' },
          { id: 'rental', label: 'Renta' },
        ]}
      />

      <View style={styles.search}>
        <MaterialIcons name="search" size={20} color={theme.color.muted} />
        <TextInput
          value={queryText}
          onChangeText={setQueryText}
          placeholder="Buscar folio, equipo, alumno, maestro…"
          placeholderTextColor={theme.color.muted}
          style={styles.searchInput}
        />
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <Notice title="Sin movimientos" description="No hay préstamos con esos filtros." />
      ) : (
        <View style={styles.listCard}>
          {paging.pageItems.map((loan, index) => {
            const open = expandedId === loan.id;
            const deliveredBy = resolveActor(loan.deliveredBy, usersById);
            const approvedBy = resolveActor(loan.approvedBy, usersById);
            const returnedBy = resolveActor(loan.returnedBy, usersById);
            const manager =
              loan.deliveredBy
                ? deliveredBy
                : loan.approvedBy
                  ? approvedBy
                  : '—';

            return (
              <View
                key={loan.id}
                style={[styles.rowWrap, index === paging.pageItems.length - 1 && !open && styles.rowWrapLast]}
              >
                <Pressable
                  onPress={() => setExpandedId((id) => (id === loan.id ? null : loan.id))}
                  style={[styles.row, open && styles.rowOpen]}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.folio}>#{loan.folio}</Text>
                    <Text style={styles.equip} numberOfLines={1}>
                      {loan.equipmentName}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {loan.studentName} · {formatDate(loan.requestedAt)}
                    </Text>
                  </View>
                  <Badge label={loanStatusLabel(loan.status)} tone={toneForStatus(loan.status)} />
                  <MaterialIcons
                    name={open ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={theme.color.muted}
                  />
                </Pressable>

                {open ? (
                  <View style={styles.detail}>
                    <DetailRow
                      label="Tipo / código"
                      value={`${loan.loanType === 'rental' ? 'Renta' : 'Académico'} · ${loan.equipmentCode}`}
                    />
                    <DetailRow label="Solicitó" value={`${loan.studentName} · ${formatDate(loan.requestedAt)}`} />
                    <DetailRow label="Profesor / lab" value={loan.teacherName || '—'} />
                    <DetailRow label="Gestionó" value={`${manager} · ${formatDate(loan.deliveredAt ?? loan.approvedAt ?? loan.rejectedAt)}`} />
                    <DetailRow
                      label="Devolución"
                      value={
                        loan.returnedAt
                          ? `${returnedBy} · ${formatDate(loan.returnedAt)}`
                          : 'Pendiente'
                      }
                    />
                  </View>
                ) : null}
              </View>
            );
          })}

          <ListPagination
            page={paging.page}
            totalPages={paging.totalPages}
            from={paging.from}
            to={paging.to}
            total={paging.total}
            pageNumbers={paging.pageNumbers}
            onChange={setPage}
          />
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: theme.color.ink, fontSize: theme.font.size.md },
  count: {
    minWidth: 28,
    textAlign: 'center',
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: 12,
    backgroundColor: theme.color.infoSoft,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  listCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 8,
    ...theme.shadow.soft,
  },
  rowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
  },
  rowWrapLast: { borderBottomWidth: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  rowOpen: { backgroundColor: theme.color.infoSoft },
  rowMain: { flex: 1, minWidth: 0 },
  folio: { color: theme.color.muted, fontWeight: '800', fontSize: 11 },
  equip: { marginTop: 2, color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.md },
  meta: { marginTop: 2, color: theme.color.muted, fontSize: 12 },
  detail: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  detailLabel: { color: theme.color.muted, fontSize: 12, fontWeight: '700' },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '600',
  },
});
