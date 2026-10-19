import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

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
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
    >
      <Text style={styles.title}>Historial de movimientos</Text>
      <Text style={styles.subtitle}>
        Registro cronológico de préstamos, entregas y devoluciones. Toca cualquier movimiento para
        ver los detalles completos.
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
        <View style={styles.listContainer}>
          {paging.pageItems.map((loan) => {
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
                style={[styles.loanCard, open && styles.loanCardOpen]}
              >
                <Pressable
                  onPress={() => setExpandedId((id) => (id === loan.id ? null : loan.id))}
                  style={styles.cardHeaderPressable}
                >
                  {/* Fila 1: Folio chip, Tipo de préstamo y Badge de estatus */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.folioBadge}>
                      <MaterialIcons name="tag" size={13} color={theme.color.navy} />
                      <Text style={styles.folioText}>#{loan.folio}</Text>
                    </View>

                    <View style={[styles.typeBadge, loan.loanType === 'rental' && styles.typeBadgeRental]}>
                      <MaterialIcons
                        name={loan.loanType === 'rental' ? 'handshake' : 'school'}
                        size={13}
                        color={loan.loanType === 'rental' ? '#92400E' : '#1E40AF'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.typeBadgeText, loan.loanType === 'rental' && styles.typeBadgeTextRental]}>
                        {loan.loanType === 'rental' ? 'Renta particular' : 'Académico'}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }} />

                    <Badge label={loanStatusLabel(loan.status)} tone={toneForStatus(loan.status)} />

                    <View style={[styles.chevronWrap, open && styles.chevronWrapOpen]}>
                      <MaterialIcons
                        name={open ? 'expand-less' : 'expand-more'}
                        size={20}
                        color={open ? theme.color.navy : theme.color.muted}
                      />
                    </View>
                  </View>

                  {/* Fila 2: Icono de equipo + Nombre del equipo + Código interno */}
                  <View style={styles.cardEquipRow}>
                    <View style={[styles.equipIconWrap, open && styles.equipIconWrapOpen]}>
                      <MaterialIcons
                        name="build-circle"
                        size={24}
                        color={open ? '#2563EB' : theme.color.navy}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.equipName} numberOfLines={2}>
                        {loan.equipmentName}
                      </Text>
                      {Boolean(loan.equipmentCode) && (
                        <Text style={styles.equipCode}>Código: {loan.equipmentCode}</Text>
                      )}
                    </View>
                  </View>

                  {/* Fila 3: Solicitante y Fecha con iconos y espacio claro */}
                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="person-outline" size={15} color={theme.color.muted} style={{ marginRight: 5 }} />
                      <Text style={styles.metaStudent} numberOfLines={1}>
                        {loan.studentName}
                      </Text>
                    </View>

                    <View style={styles.metaDot} />

                    <View style={styles.metaItem}>
                      <MaterialIcons name="schedule" size={14} color={theme.color.muted} style={{ marginRight: 5 }} />
                      <Text style={styles.metaDate}>{formatDate(loan.requestedAt)}</Text>
                    </View>
                  </View>
                </Pressable>

                {/* Sección expandida de detalles */}
                {open && (
                  <View style={styles.detailContainer}>
                    <View style={styles.detailGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>Tipo de préstamo</Text>
                        <Text style={styles.detailItemValue}>
                          {loan.loanType === 'rental' ? 'Renta particular' : 'Préstamo académico'}
                        </Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>Profesor responsable</Text>
                        <Text style={styles.detailItemValue}>{loan.teacherName || 'Sin profesor registrado'}</Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>Fecha de solicitud</Text>
                        <Text style={styles.detailItemValue}>{formatDate(loan.requestedAt)}</Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>Fecha límite de retorno</Text>
                        <Text style={styles.detailItemValue}>{formatDate(loan.dueAt)}</Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>Despacho / Entrega</Text>
                        <Text style={styles.detailItemValue}>
                          {manager !== '—'
                            ? `${manager} (${formatDate(loan.deliveredAt ?? loan.approvedAt)})`
                            : 'Pendiente de entrega'}
                        </Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>Recepción / Devolución</Text>
                        <Text style={styles.detailItemValue}>
                          {loan.returnedAt ? `${returnedBy} (${formatDate(loan.returnedAt)})` : 'Pendiente de devolución'}
                        </Text>
                      </View>
                    </View>

                    {/* Notas u observaciones */}
                    {(loan.deliveryNotes || loan.damageNotes || loan.notes) && (
                      <View style={styles.detailNotesBox}>
                        <MaterialIcons name="info-outline" size={16} color="#1E40AF" style={{ marginTop: 2, marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailNotesTitle}>Observaciones registradas</Text>
                          <Text style={styles.detailNotesText}>
                            {[loan.deliveryNotes, loan.damageNotes, loan.notes].filter(Boolean).join(' • ')}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 28, paddingBottom: 48 },
  contentMobile: { padding: 14, paddingBottom: 48 },

  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    lineHeight: 20,
  },

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
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    outlineStyle: 'none' as unknown as undefined,
    outlineWidth: 0,
  },
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

  listContainer: {
    gap: 0,
  },

  loanCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: theme.radius.lg,
    marginBottom: 12,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  loanCardOpen: {
    borderColor: '#93C5FD',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },

  cardHeaderPressable: {
    padding: 16,
  },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  folioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2F6',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  folioText: {
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeRental: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  typeBadgeTextRental: {
    color: '#92400E',
  },

  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  chevronWrapOpen: {
    backgroundColor: '#DBEAFE',
  },

  cardEquipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  equipIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipIconWrapOpen: {
    backgroundColor: '#EFF6FF',
  },
  equipName: {
    color: theme.color.navy,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  equipCode: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaStudent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  metaDate: {
    fontSize: 12,
    color: theme.color.muted,
    fontWeight: '500',
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 2,
  },

  detailContainer: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailItem: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
  },
  detailItemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailItemValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.ink,
  },

  detailNotesBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 12,
  },
  detailNotesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 2,
  },
  detailNotesText: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 18,
  },
});
