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
  buildRequestBatches,
  getInitials,
  loanStatusLabel,
  type Loan,
  type LoanStatus,
  type RequestBatch,
} from '@lab-topo/domain';
import { watchLoansForStudent } from '@lab-topo/services';
import { Avatar, Badge, Notice, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { ListPagination } from '../components/ListPagination';
import { DEFAULT_PAGE_SIZE, paginate } from '../lib/pagination';

type RequestTab = 'pending' | 'delivered' | 'returned' | 'rejected';
type TableColumn = 'folio' | 'equip' | 'teacher' | 'requested' | 'due' | 'status';

const TABS: { id: RequestTab; label: string }[] = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'delivered', label: 'Material entregado' },
  { id: 'returned', label: 'Devuelto' },
  { id: 'rejected', label: 'Rechazado' },
];

const COLUMNS: { id: TableColumn; label: string }[] = [
  { id: 'folio', label: 'Folio' },
  { id: 'equip', label: 'Equipo' },
  { id: 'teacher', label: 'Profesor' },
  { id: 'requested', label: 'Solicitada' },
  { id: 'due', label: 'Devolver' },
  { id: 'status', label: 'Estado' },
];

const TAB_COLORS: Record<
  RequestTab,
  { soft: string; mid: string; strong: string; text: string; border: string }
> = {
  pending: {
    soft: 'rgba(34, 102, 216, 0.14)',
    mid: 'rgba(34, 102, 216, 0.08)',
    strong: 'rgba(34, 102, 216, 0.32)',
    text: theme.color.info,
    border: 'rgba(34, 102, 216, 0.28)',
  },
  delivered: {
    soft: 'rgba(167, 106, 0, 0.16)',
    mid: 'rgba(167, 106, 0, 0.08)',
    strong: 'rgba(167, 106, 0, 0.34)',
    text: theme.color.warning,
    border: 'rgba(167, 106, 0, 0.28)',
  },
  returned: {
    soft: 'rgba(22, 133, 91, 0.16)',
    mid: 'rgba(22, 133, 91, 0.08)',
    strong: 'rgba(22, 133, 91, 0.34)',
    text: theme.color.success,
    border: 'rgba(22, 133, 91, 0.28)',
  },
  rejected: {
    soft: 'rgba(217, 4, 41, 0.14)',
    mid: 'rgba(217, 4, 41, 0.08)',
    strong: 'rgba(217, 4, 41, 0.34)',
    text: theme.color.red,
    border: 'rgba(217, 4, 41, 0.28)',
  },
};

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

export function StudentRequestsPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<RequestTab>('pending');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<TableColumn | null>(null);

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

  const batches = useMemo(() => buildRequestBatches(loans), [loans]);

  const counts = useMemo(() => {
    const result: Record<RequestTab, number> = {
      pending: 0,
      delivered: 0,
      returned: 0,
      rejected: 0,
    };
    for (const b of batches) {
      (Object.keys(result) as RequestTab[]).forEach((key) => {
        if (matchesTab(b.status, key)) result[key] += 1;
      });
    }
    return result;
  }, [batches]);

  const filtered = useMemo(
    () => batches.filter((b) => matchesTab(b.status, tab)),
    [batches, tab]
  );

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
    setActiveColumn(null);
  }, [tab]);

  const paging = useMemo(() => paginate(filtered, page), [filtered, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  const pageItems = paging.pageItems;
  const selected = filtered.find((b) => b.id === selectedId) ?? null;
  const accent = TAB_COLORS[tab];

  const colStyle = (id: TableColumn) => {
    switch (id) {
      case 'folio':
        return styles.colFolio;
      case 'equip':
        return styles.colEquip;
      case 'teacher':
        return styles.colTeacher;
      case 'requested':
      case 'due':
        return styles.colDate;
      case 'status':
        return styles.colStatus;
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Mis movimientos</Text>
          <Text style={styles.title}>Solicitudes</Text>
          <Text style={styles.subtitle}>
            Revisa tus pedidos por estado. Se muestran {DEFAULT_PAGE_SIZE} por página.
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
            <View
              style={[
                styles.tableHead,
                { backgroundColor: accent.soft, borderBottomColor: accent.border },
              ]}
            >
              {COLUMNS.map((col) => {
                const active = activeColumn === col.id;
                return (
                  <Pressable
                    key={col.id}
                    onPress={() =>
                      setActiveColumn((current) => (current === col.id ? null : col.id))
                    }
                    style={[
                      styles.thCell,
                      colStyle(col.id),
                      active && { backgroundColor: accent.strong },
                    ]}
                  >
                    <Text style={[styles.th, { color: accent.text }]}>{col.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {pageItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  No hay solicitudes en “{TABS.find((t) => t.id === tab)?.label}”.
                </Text>
              </View>
            ) : (
              pageItems.map((batch, index) => {
                const active = selectedId === batch.id;
                const isMulti = batch.loans.length > 1;
                const mainFolio = batch.folio || batch.loans[0]?.folio;
                return (
                  <Pressable
                    key={batch.id}
                    onPress={() =>
                      setSelectedId((current) => (current === batch.id ? null : batch.id))
                    }
                    style={[
                      styles.tr,
                      index === pageItems.length - 1 && !selected && styles.trLast,
                      active && styles.trActive,
                    ]}
                  >
                    <View
                      style={[
                        colStyle('folio'),
                        activeColumn === 'folio' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={styles.td} numberOfLines={1}>
                        #{mainFolio}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('equip'),
                        activeColumn === 'equip' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={[styles.td, styles.tdStrong]} numberOfLines={1}>
                        {isMulti
                          ? `${batch.loans.length} materiales (${batch.loans.map((l) => l.equipmentName).join(', ')})`
                          : (batch.loans[0]?.equipmentName ?? '—')}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('teacher'),
                        activeColumn === 'teacher' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={styles.td} numberOfLines={1}>
                        {batch.teacherName}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('requested'),
                        activeColumn === 'requested' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={styles.td} numberOfLines={1}>
                        {formatDateTime(batch.requestedAt)}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('due'),
                        activeColumn === 'due' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={styles.td} numberOfLines={1}>
                        {formatDateTime(batch.dueAt)}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('status'),
                        styles.statusCell,
                        activeColumn === 'status' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Badge
                        label={loanStatusLabel(batch.status)}
                        tone={toneForStatus(batch.status)}
                      />
                    </View>
                  </Pressable>
                );
              })
            )}

            {selected ? (
              <View style={styles.detailBox}>
                <View style={styles.detailHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailTitle}>
                      Solicitud #{selected.folio || selected.loans[0]?.folio}
                    </Text>
                    <Text style={styles.detailSubtitle}>
                      {selected.loans.length === 1
                        ? '1 material solicitado'
                        : `${selected.loans.length} materiales solicitados`}
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelectedId(null)} hitSlop={8}>
                    <MaterialIcons name="close" size={20} color={theme.color.muted} />
                  </Pressable>
                </View>

                {[
                  ['Profesor', selected.teacherName],
                  ['Solicitada', formatDateTime(selected.requestedAt)],
                  ['Devolver antes de', formatDateTime(selected.dueAt)],
                  ['Estado general', loanStatusLabel(selected.status)],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value}</Text>
                  </View>
                ))}

                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: theme.color.navy, marginBottom: 8 }}>
                    Materiales en esta solicitud ({selected.loans.length}):
                  </Text>
                  {selected.loans.map((item, idx) => (
                    <View
                      key={item.id}
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: theme.color.navy,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.color.navy }} numberOfLines={1}>
                            {item.equipmentName}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.color.muted }}>
                            Código: {item.equipmentCode}
                          </Text>
                        </View>
                        <Badge label={loanStatusLabel(item.status)} tone={toneForStatus(item.status)} />
                      </View>

                      {item.deliveryNotes ? (
                        <View style={{ marginTop: 6, padding: 6, backgroundColor: '#FEF3C7', borderRadius: 4 }}>
                          <Text style={{ fontSize: 11, color: '#92400E' }}>
                            Nota al entregar: {item.deliveryNotes}
                          </Text>
                        </View>
                      ) : null}

                      {item.kitItems && item.kitItems.length > 0 ? (
                        <View style={{ marginTop: 8, padding: 8, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#EEF2F6' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.color.navy, marginBottom: 4 }}>
                            Kit incluido ({item.kitItems.length} artículos):
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {item.kitItems.map((k, i) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 120 }}>
                                <MaterialIcons name="check" size={12} color={theme.color.success} />
                                <Text style={{ fontSize: 11, color: theme.color.ink }}>{k}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {item.extraItems && item.extraItems.length > 0 ? (
                        <View style={{ marginTop: 8, padding: 8, backgroundColor: '#EFF6FF', borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.color.navy, marginBottom: 4 }}>
                            Materiales extras:
                          </Text>
                          {item.extraItems.map((ex, i) => (
                            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                              <Text style={{ fontSize: 11, color: theme.color.ink }}>• {ex.name}</Text>
                              <Text style={{ fontSize: 11, color: theme.color.navy, fontWeight: '700' }}>x{ex.quantity}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          <ListPagination
            page={paging.page}
            totalPages={paging.totalPages}
            from={paging.from}
            to={paging.to}
            total={paging.total}
            pageNumbers={paging.pageNumbers}
            onChange={setPage}
          />
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
    alignItems: 'stretch',
    borderBottomWidth: 1,
  },
  thCell: {
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  th: {
    fontSize: theme.font.size.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  trLast: { borderBottomWidth: 0 },
  trActive: { backgroundColor: '#F5F9FF' },
  td: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  tdStrong: {
    color: theme.color.navy,
    fontWeight: '700',
  },
  colFolio: { width: '14%' },
  colEquip: { width: '24%' },
  colTeacher: { width: '18%' },
  colDate: { width: '14%' },
  colStatus: { width: '16%' },
  statusCell: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
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
  detailSubtitle: {
    color: theme.color.muted,
    fontSize: 12,
    marginTop: 2,
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
