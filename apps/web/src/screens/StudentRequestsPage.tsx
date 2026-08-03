import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import {
  getInitials,
  loanStatusLabel,
  type Loan,
  type LoanStatus,
} from '@lab-topo/domain';
import { watchLoansForStudent } from '@lab-topo/services';
import { Avatar, Badge, Notice, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

const PAGE_SIZE = 10;

type RequestTab = 'pending' | 'delivered' | 'returned' | 'rejected';

const TABS: { id: RequestTab; label: string }[] = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'delivered', label: 'Material entregado' },
  { id: 'returned', label: 'Devuelto' },
  { id: 'rejected', label: 'Rechazado' },
];

function matchesTab(status: LoanStatus, tab: RequestTab): boolean {
  switch (tab) {
    case 'pending':
      return status === 'pending' || status === 'approved';
    case 'delivered':
      return status === 'delivered';
    case 'returned':
      return status === 'returned' || status === 'returned_late';
    case 'rejected':
      return status === 'rejected' || status === 'cancelled';
    default:
      return false;
  }
}

function toneForStatus(status: LoanStatus): BadgeTone {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'rejected':
    case 'cancelled':
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

function formatDateTime(value: string | null): string {
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

function buildPageWindow(current: number, total: number): number[] {
  if (total <= 10) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = 4;
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + 9);
  start = Math.max(1, end - 9);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function StudentRequestsPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<RequestTab>('pending');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = watchLoansForStudent(
      user.uid,
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

  const counts = useMemo(() => {
    const result: Record<RequestTab, number> = {
      pending: 0,
      delivered: 0,
      returned: 0,
      rejected: 0,
    };
    for (const loan of loans) {
      (Object.keys(result) as RequestTab[]).forEach((key) => {
        if (matchesTab(loan.status, key)) result[key] += 1;
      });
    }
    return result;
  }, [loans]);

  const filtered = useMemo(
    () => loans.filter((loan) => matchesTab(loan.status, tab)),
    [loans, tab]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
  }, [tab]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const selected = filtered.find((l) => l.id === selectedId) ?? null;
  const pageNumbers = buildPageWindow(page, totalPages);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Mis movimientos</Text>
          <Text style={styles.title}>Solicitudes</Text>
          <Text style={styles.subtitle}>
            Revisa tus pedidos por estado. Se muestran {PAGE_SIZE} por página.
          </Text>
        </View>
        <Avatar initials={getInitials(user?.displayName ?? 'AL')} size={40} />
      </View>

      {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
      {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 20 }} /> : null}

      {!loading ? (
        <>
          <View style={styles.tabs}>
            {TABS.map((item) => {
              const active = item.id === tab;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {item.label}
                  </Text>
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                      {counts[item.id]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.tableCard}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colFolio]}>Folio</Text>
              <Text style={[styles.th, styles.colEquip]}>Equipo</Text>
              <Text style={[styles.th, styles.colTeacher]}>Profesor</Text>
              <Text style={[styles.th, styles.colDate]}>Solicitada</Text>
              <Text style={[styles.th, styles.colDate]}>Devolver</Text>
              <Text style={[styles.th, styles.colStatus]}>Estado</Text>
            </View>

            {pageItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  No hay solicitudes en “{TABS.find((t) => t.id === tab)?.label}”.
                </Text>
              </View>
            ) : (
              pageItems.map((loan, index) => {
                const active = selectedId === loan.id;
                return (
                  <Pressable
                    key={loan.id}
                    onPress={() =>
                      setSelectedId((current) => (current === loan.id ? null : loan.id))
                    }
                    style={[
                      styles.tr,
                      index === pageItems.length - 1 && !selected && styles.trLast,
                      active && styles.trActive,
                    ]}
                  >
                    <Text style={[styles.td, styles.colFolio]} numberOfLines={1}>
                      #{loan.folio}
                    </Text>
                    <Text style={[styles.td, styles.colEquip, styles.tdStrong]} numberOfLines={1}>
                      {loan.equipmentName}
                    </Text>
                    <Text style={[styles.td, styles.colTeacher]} numberOfLines={1}>
                      {loan.teacherName}
                    </Text>
                    <Text style={[styles.td, styles.colDate]} numberOfLines={1}>
                      {formatDateTime(loan.requestedAt)}
                    </Text>
                    <Text style={[styles.td, styles.colDate]} numberOfLines={1}>
                      {formatDateTime(loan.dueAt)}
                    </Text>
                    <View style={[styles.colStatus, styles.statusCell]}>
                      <Badge
                        label={loanStatusLabel(loan.status)}
                        tone={toneForStatus(loan.status)}
                      />
                    </View>
                  </Pressable>
                );
              })
            )}

            {selected ? (
              <View style={styles.detailBox}>
                <View style={styles.detailHead}>
                  <Text style={styles.detailTitle}>Detalle #{selected.folio}</Text>
                  <Pressable onPress={() => setSelectedId(null)} hitSlop={8}>
                    <MaterialIcons name="close" size={20} color={theme.color.muted} />
                  </Pressable>
                </View>
                {[
                  ['Equipo', selected.equipmentName],
                  ['Código', selected.equipmentCode],
                  ['Profesor', selected.teacherName],
                  ['Solicitada', formatDateTime(selected.requestedAt)],
                  ['Devolver antes de', formatDateTime(selected.dueAt)],
                  ['Estado', loanStatusLabel(selected.status)],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {filtered.length > 0 ? (
            <View style={styles.pagination}>
              <Text style={styles.pageInfo}>
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
              </Text>

              <View style={styles.pageControls}>
                <Pressable
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={[styles.pageNav, page <= 1 && styles.pageNavDisabled]}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={20}
                    color={page <= 1 ? theme.color.muted : theme.color.info}
                  />
                  <Text style={[styles.pageNavText, page <= 1 && styles.pageNavTextDisabled]}>
                    Anterior
                  </Text>
                </Pressable>

                <View style={styles.pageNumbers}>
                  {pageNumbers.map((num) => {
                    const active = num === page;
                    return (
                      <Pressable
                        key={num}
                        onPress={() => setPage(num)}
                        style={[styles.pageNum, active && styles.pageNumActive]}
                      >
                        <Text style={[styles.pageNumText, active && styles.pageNumTextActive]}>
                          {num}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={[styles.pageNav, page >= totalPages && styles.pageNavDisabled]}
                >
                  <Text
                    style={[
                      styles.pageNavText,
                      page >= totalPages && styles.pageNavTextDisabled,
                    ]}
                  >
                    Siguiente
                  </Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={page >= totalPages ? theme.color.muted : theme.color.info}
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 28, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16,
  },
  eyebrow: { color: theme.color.muted, fontSize: theme.font.size.sm, marginBottom: 4 },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 6,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    maxWidth: 560,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  tabActive: {
    borderColor: theme.color.navy,
    backgroundColor: theme.color.infoSoft,
  },
  tabLabel: {
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: theme.color.navy,
  },
  tabCount: {
    minWidth: 26,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
  },
  tabCountActive: {
    backgroundColor: theme.color.navy,
  },
  tabCountText: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
  },
  tabCountTextActive: {
    color: '#fff',
  },
  tableCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 12,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F5F7FA',
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
  },
  th: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  trLast: { borderBottomWidth: 0 },
  trActive: { backgroundColor: '#F5F9FF' },
  td: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
  },
  tdStrong: {
    color: theme.color.navy,
    fontWeight: '700',
  },
  colFolio: { width: '14%', paddingRight: 8 },
  colEquip: { width: '24%', paddingRight: 8 },
  colTeacher: { width: '18%', paddingRight: 8 },
  colDate: { width: '14%', paddingRight: 8 },
  colStatus: { width: '16%' },
  statusCell: { alignItems: 'flex-start' },
  emptyBox: {
    padding: 28,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.color.muted,
    fontSize: theme.font.size.md,
  },
  detailBox: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    backgroundColor: '#FBFCFE',
  },
  detailHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  detailLabel: { color: theme.color.muted, fontSize: theme.font.size.md },
  detailValue: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
    textAlign: 'right',
  },
  pagination: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageInfo: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    fontWeight: '600',
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pageNavDisabled: { opacity: 0.45 },
  pageNavText: {
    color: theme.color.info,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  pageNavTextDisabled: {
    color: theme.color.muted,
  },
  pageNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageNum: {
    minWidth: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pageNumActive: {
    backgroundColor: theme.color.warningSoft,
  },
  pageNumText: {
    color: theme.color.info,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  pageNumTextActive: {
    color: theme.color.warning,
  },
});
