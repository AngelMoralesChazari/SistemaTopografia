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
  getInitials,
  loanStatusLabel,
  type Loan,
  type LoanStatus,
} from '@lab-topo/domain';
import { watchLoansForTeacher } from '@lab-topo/services';
import { Avatar, Badge, Notice, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

const PAGE_SIZE = 10;
const PREVIEW_LIMIT = 2;

type RequestTab = 'pending' | 'delivered' | 'returned' | 'rejected';
type TableColumn = 'student' | 'number' | 'loans' | 'recent' | 'due' | 'status';

type StudentGroup = {
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  loans: Loan[];
};

const TABS: { id: RequestTab; label: string }[] = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'delivered', label: 'Material entregado' },
  { id: 'returned', label: 'Devuelto' },
  { id: 'rejected', label: 'Rechazado' },
];

const COLUMNS: { id: TableColumn; label: string }[] = [
  { id: 'student', label: 'Alumno' },
  { id: 'number', label: 'Matrícula' },
  { id: 'loans', label: 'Préstamos' },
  { id: 'recent', label: 'Material reciente' },
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

function isOverdue(loan: Loan): boolean {
  return (
    loan.status === 'delivered' &&
    !!loan.dueAt &&
    new Date(loan.dueAt).getTime() < Date.now()
  );
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

function groupStatus(loans: Loan[]): { label: string; tone: BadgeTone } {
  if (loans.some(isOverdue)) return { label: 'Retraso', tone: 'late' };
  if (loans.some((l) => l.status === 'delivered')) return { label: 'En curso', tone: 'ok' };
  if (loans.some((l) => l.status === 'pending' || l.status === 'approved')) {
    return { label: 'Pendiente', tone: 'pending' };
  }
  if (loans.some((l) => l.status === 'returned' || l.status === 'returned_late')) {
    return { label: 'Devuelto', tone: 'muted' };
  }
  return { label: loanStatusLabel(loans[0]?.status ?? 'pending'), tone: 'muted' };
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
  if (total <= 10) return Array.from({ length: total }, (_, i) => i + 1);
  const half = 4;
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + 9);
  start = Math.max(1, end - 9);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function TeacherStudentsPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<RequestTab>('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeColumn, setActiveColumn] = useState<TableColumn | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = watchLoansForTeacher(
      user.uid,
      (next) => {
        // Excluye préstamos propios del maestro (usa Catálogo / Mis solicitudes).
        setLoans(next.filter((loan) => loan.studentId !== user.uid));
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

  const groups = useMemo((): StudentGroup[] => {
    const map = new Map<string, StudentGroup>();
    for (const loan of loans) {
      const current = map.get(loan.studentId);
      if (current) current.loans.push(loan);
      else {
        map.set(loan.studentId, {
          studentId: loan.studentId,
          studentName: loan.studentName,
          studentNumber: loan.studentNumber,
          loans: [loan],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName, 'es')
    );
  }, [loans]);

  const counts = useMemo(() => {
    const result: Record<RequestTab, number> = {
      pending: 0,
      delivered: 0,
      returned: 0,
      rejected: 0,
    };
    for (const group of groups) {
      (Object.keys(result) as RequestTab[]).forEach((key) => {
        if (group.loans.some((loan) => matchesTab(loan.status, key))) {
          result[key] += 1;
        }
      });
    }
    return result;
  }, [groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((group) => {
      const hasTabLoan = group.loans.some((loan) => matchesTab(loan.status, tab));
      if (!hasTabLoan) return false;
      if (!q) return true;
      return `${group.studentName} ${group.studentNumber ?? ''}`.toLowerCase().includes(q);
    });
  }, [groups, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
    setActiveColumn(null);
  }, [tab, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const selected = filtered.find((g) => g.studentId === selectedId) ?? null;
  const pageNumbers = buildPageWindow(page, totalPages);
  const accent = TAB_COLORS[tab];

  const colStyle = (id: TableColumn) => {
    switch (id) {
      case 'student':
        return styles.colStudent;
      case 'number':
        return styles.colNumber;
      case 'loans':
        return styles.colLoans;
      case 'recent':
        return styles.colRecent;
      case 'due':
        return styles.colDue;
      case 'status':
        return styles.colStatus;
    }
  };

  const tabLoansOf = (group: StudentGroup) =>
    group.loans.filter((loan) => matchesTab(loan.status, tab));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Supervisión académica</Text>
          <Text style={styles.title}>Alumnos</Text>
          <Text style={styles.subtitle}>
            Consulta a tus alumnos y el material que han solicitado. {PAGE_SIZE} por página.
          </Text>
        </View>
        <Avatar initials={getInitials(user?.displayName ?? 'CR')} size={40} />
      </View>

      {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
      {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 20 }} /> : null}

      {!loading ? (
        <>
          <View style={styles.search}>
            <MaterialIcons name="search" size={20} color={theme.color.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar alumno o matrícula..."
              placeholderTextColor={theme.color.muted}
              style={styles.searchInput}
            />
          </View>

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
                  No hay alumnos con solicitudes en “{TABS.find((t) => t.id === tab)?.label}”.
                </Text>
              </View>
            ) : (
              pageItems.map((group, index) => {
                const active = selectedId === group.studentId;
                const tabLoans = tabLoansOf(group);
                const previewLoan = tabLoans[0] ?? group.loans[0];
                const status = groupStatus(tabLoans.length > 0 ? tabLoans : group.loans);

                return (
                  <Pressable
                    key={group.studentId}
                    onPress={() =>
                      setSelectedId((current) =>
                        current === group.studentId ? null : group.studentId
                      )
                    }
                    style={[
                      styles.tr,
                      index === pageItems.length - 1 && !selected && styles.trLast,
                      active && styles.trActive,
                    ]}
                  >
                    <View
                      style={[
                        colStyle('student'),
                        styles.studentCell,
                        activeColumn === 'student' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Avatar initials={getInitials(group.studentName)} size={28} />
                      <Text style={[styles.td, styles.tdStrong]} numberOfLines={1}>
                        {group.studentName}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('number'),
                        activeColumn === 'number' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={styles.td} numberOfLines={1}>
                        {group.studentNumber ?? '—'}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('loans'),
                        activeColumn === 'loans' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={styles.td}>
                        {tabLoans.length}/{group.loans.length}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('recent'),
                        activeColumn === 'recent' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={styles.td} numberOfLines={1}>
                        {previewLoan?.equipmentName ?? '—'}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('due'),
                        activeColumn === 'due' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Text style={styles.td} numberOfLines={1}>
                        {formatDateTime(previewLoan?.dueAt ?? null)}
                      </Text>
                    </View>
                    <View
                      style={[
                        colStyle('status'),
                        styles.statusCell,
                        activeColumn === 'status' && { backgroundColor: accent.mid },
                      ]}
                    >
                      <Badge label={status.label} tone={status.tone} />
                    </View>
                  </Pressable>
                );
              })
            )}

            {selected ? (
              <View style={styles.detailBox}>
                <View style={styles.detailHead}>
                  <View>
                    <Text style={styles.detailTitle}>{selected.studentName}</Text>
                    <Text style={styles.detailMeta}>
                      {selected.studentNumber
                        ? `Matrícula ${selected.studentNumber}`
                        : 'Sin matrícula'}{' '}
                      · {selected.loans.length} préstamo
                      {selected.loans.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelectedId(null)} hitSlop={8}>
                    <MaterialIcons name="close" size={20} color={theme.color.muted} />
                  </Pressable>
                </View>

                <Text style={styles.previewHint}>
                  Material reciente (máx. {PREVIEW_LIMIT}). Lista completa abajo.
                </Text>

                {selected.loans.slice(0, PREVIEW_LIMIT).map((loan) => {
                  const late = isOverdue(loan);
                  return (
                    <View key={loan.id} style={styles.loanBlock}>
                      <View style={styles.loanHead}>
                        <Text style={styles.loanFolio}>#{loan.folio}</Text>
                        <Badge
                          label={late ? 'Retrasado' : loanStatusLabel(loan.status)}
                          tone={late ? 'late' : toneForStatus(loan.status)}
                        />
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Equipo</Text>
                        <Text style={styles.detailValue}>{loan.equipmentName}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Código</Text>
                        <Text style={styles.detailValue}>{loan.equipmentCode}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Solicitada</Text>
                        <Text style={styles.detailValue}>
                          {formatDateTime(loan.requestedAt)}
                        </Text>
                      </View>
                      <View style={[styles.detailRow, styles.detailRowLast]}>
                        <Text style={styles.detailLabel}>Devolución</Text>
                        <Text style={[styles.detailValue, { color: theme.color.navy }]}>
                          {formatDateTime(loan.dueAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {selected.loans.length > PREVIEW_LIMIT ? (
                  <View style={styles.historyBox}>
                    <Text style={styles.historyTitle}>
                      Historial completo ({selected.loans.length})
                    </Text>
                    {selected.loans.slice(PREVIEW_LIMIT).map((loan) => {
                      const late = isOverdue(loan);
                      return (
                        <View key={loan.id} style={styles.historyRow}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.historyName} numberOfLines={1}>
                              {loan.equipmentName}
                            </Text>
                            <Text style={styles.historyMeta} numberOfLines={1}>
                              #{loan.folio} · {formatDateTime(loan.requestedAt)}
                            </Text>
                          </View>
                          <Badge
                            label={late ? 'Retrasado' : loanStatusLabel(loan.status)}
                            tone={late ? 'late' : toneForStatus(loan.status)}
                          />
                        </View>
                      );
                    })}
                  </View>
                ) : null}
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
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    outlineStyle: 'none' as unknown as undefined,
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
  tabLabelActive: { color: theme.color.navy },
  tabCount: {
    minWidth: 26,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
  },
  tabCountActive: { backgroundColor: theme.color.navy },
  tabCountText: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
  },
  tabCountTextActive: { color: '#fff' },
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
    paddingLeft: 0,
  },
  studentCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
  },
  colStudent: { width: '22%' },
  colNumber: { width: '14%' },
  colLoans: { width: '12%' },
  colRecent: { width: '22%' },
  colDue: { width: '16%' },
  colStatus: { width: '14%' },
  statusCell: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  emptyBox: { padding: 28, alignItems: 'center' },
  emptyText: { color: theme.color.muted, fontSize: theme.font.size.md },
  detailBox: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    backgroundColor: '#FBFCFE',
  },
  detailHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  detailTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.xl,
    fontWeight: '800',
  },
  detailMeta: {
    marginTop: 4,
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },
  previewHint: {
    marginBottom: 10,
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },
  loanBlock: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EDF0F3',
    backgroundColor: '#fff',
  },
  loanHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  loanFolio: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: theme.color.muted, fontSize: theme.font.size.md },
  detailValue: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
    textAlign: 'right',
  },
  historyBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: '#fff',
  },
  historyTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F6',
  },
  historyName: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  historyMeta: {
    marginTop: 2,
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
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
  pageNavTextDisabled: { color: theme.color.muted },
  pageNumbers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageNum: {
    minWidth: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pageNumActive: { backgroundColor: theme.color.warningSoft },
  pageNumText: {
    color: theme.color.info,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  pageNumTextActive: { color: theme.color.warning },
});
