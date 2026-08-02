import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import {
  getInitials,
  loanStatusLabel,
  type Loan,
  type LoanStatus,
} from '@lab-topo/domain';
import {
  deliverLoan,
  rejectLoan,
  returnLoan,
  watchEquipment,
  watchLabQueue,
} from '@lab-topo/services';
import { Avatar, Button, Notice, RequestCard, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type LabTab = 'solicitudes' | 'aceptados' | 'rechazados';

const TABS: { id: LabTab; label: string }[] = [
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'aceptados', label: 'Aceptados' },
  { id: 'rechazados', label: 'Rechazados' },
];

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

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function displayToIso(value: string): string {
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) return value.trim();
  return value.trim();
}

function dueIsoFromLoan(loan: Loan): string {
  if (loan.dueAt) {
    const d = new Date(loan.dueAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return defaultDueDate();
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

function tabForStatus(status: LoanStatus): LabTab {
  if (status === 'rejected') return 'rechazados';
  if (status === 'delivered' || status === 'approved') return 'aceptados';
  return 'solicitudes';
}

function LabLoanItem({
  loan,
  expanded,
  dimmed,
  stock,
  busy,
  dueDisplay,
  onToggle,
  onDueChange,
  onDeliver,
  onReject,
  onReturn,
}: {
  loan: Loan;
  expanded: boolean;
  dimmed: boolean;
  stock: number | null;
  busy: boolean;
  dueDisplay: string;
  onToggle: () => void;
  onDueChange: (value: string) => void;
  onDeliver: () => void;
  onReject: () => void;
  onReturn: () => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const canManage = loan.status === 'pending' || loan.status === 'approved';

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: dimmed ? 0.38 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [dimmed, opacity]);

  return (
    <Animated.View style={[styles.cardWrap, { opacity }, expanded && styles.cardWrapActive]}>
      <RequestCard
        folio={`Solicitud #${loan.folio}`}
        statusLabel={loanStatusLabel(loan.status)}
        statusTone={toneForStatus(loan.status)}
        collapsible
        expanded={expanded}
        onToggle={onToggle}
        compactHint={`${loan.studentName} · ${loan.equipmentName}`}
        rows={[
          { label: 'Alumno', value: loan.studentName },
          { label: 'Matrícula', value: loan.studentNumber ?? '—' },
          { label: 'Profesor', value: loan.teacherName },
          { label: 'Equipo', value: loan.equipmentName },
          loan.status === 'delivered' || loan.status === 'rejected'
            ? {
                label: 'Devolver antes de',
                value: formatDateTime(loan.dueAt),
                valueColor: theme.color.navy,
              }
            : {
                label: 'Existencia',
                value:
                  stock == null ? '—' : `${stock} disponible${stock === 1 ? '' : 's'}`,
                valueColor: theme.color.success,
              },
          { label: 'Solicitada', value: formatDateTime(loan.requestedAt) },
          { label: 'Estado', value: loanStatusLabel(loan.status) },
        ]}
      />

      {expanded && canManage ? (
        <View style={styles.actionsPanel}>
          <Text style={styles.sectionLabel}>Fecha límite de devolución</Text>
          <View style={styles.dateField}>
            <TextInput
              value={dueDisplay}
              onChangeText={onDueChange}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={theme.color.muted}
              keyboardType="numbers-and-punctuation"
              style={styles.dateInput}
            />
            <Text style={styles.calendarIcon}>▦</Text>
          </View>
          <View style={styles.dual}>
            <Button
              title="Entregar equipo"
              loading={busy}
              fullWidth={false}
              style={styles.actionBtn}
              onPress={onDeliver}
            />
            {loan.status === 'pending' ? (
              <Button
                title="Rechazar"
                variant="danger"
                loading={busy}
                fullWidth={false}
                style={styles.actionBtn}
                onPress={onReject}
              />
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        </View>
      ) : null}

      {expanded && loan.status === 'delivered' ? (
        <View style={styles.actionsPanel}>
          <Button title="Registrar devolución" loading={busy} onPress={onReturn} />
        </View>
      ) : null}
    </Animated.View>
  );
}

export function LabRequestsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stockById, setStockById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<LabTab>('solicitudes');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dueById, setDueById] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successTitle, setSuccessTitle] = useState('');
  const [successSubtitle, setSuccessSubtitle] = useState('');
  const [successFolio, setSuccessFolio] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = watchLabQueue(
      user.labId,
      (next) => {
        setLoans(next);
        setLoading(false);
        setError(null);
        setExpandedId((current) => {
          if (current && next.some((l) => l.id === current)) return current;
          return null;
        });
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchEquipment(
      (items) => {
        const map: Record<string, number> = {};
        for (const item of items) map[item.id] = item.qtyAvailable;
        setStockById(map);
      },
      undefined,
      { labId: user.labId, onlyActive: true }
    );
  }, [user]);

  const counts = useMemo(() => {
    const solicitudes = loans.filter((l) => tabForStatus(l.status) === 'solicitudes').length;
    const aceptados = loans.filter((l) => tabForStatus(l.status) === 'aceptados').length;
    const rechazados = loans.filter((l) => tabForStatus(l.status) === 'rechazados').length;
    return { solicitudes, aceptados, rechazados };
  }, [loans]);

  const filtered = useMemo(
    () => loans.filter((l) => tabForStatus(l.status) === tab),
    [loans, tab]
  );

  const showSuccess = (title: string, subtitle: string, folio: string) => {
    setSuccessTitle(title);
    setSuccessSubtitle(subtitle);
    setSuccessFolio(folio);
    setSuccessOpen(true);
  };

  const closeSuccess = () => {
    setSuccessOpen(false);
    setSuccessFolio(null);
  };

  const changeTab = (next: LabTab) => {
    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setTab(next);
    setExpandedId(null);
  };

  const toggle = (loan: Loan) => {
    LayoutAnimation.configureNext({
      duration: 240,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setExpandedId((current) => {
      const opening = current !== loan.id;
      if (opening) {
        setDueById((prev) => ({
          ...prev,
          [loan.id]: prev[loan.id] ?? isoToDisplay(dueIsoFromLoan(loan)),
        }));
      }
      return opening ? loan.id : null;
    });
  };

  const onDeliver = async (loan: Loan) => {
    if (!user) return;
    const display = dueById[loan.id] ?? isoToDisplay(dueIsoFromLoan(loan));
    const iso = displayToIso(display);
    setBusy(true);
    setActionError(null);
    try {
      await deliverLoan(loan.id, user.uid, iso);
      setExpandedId(null);
      setTab('aceptados');
      showSuccess(
        'Equipo entregado',
        'El préstamo quedó registrado en Aceptados.',
        loan.folio
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo entregar.');
    } finally {
      setBusy(false);
    }
  };

  const onReject = async (loan: Loan) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      await rejectLoan(loan.id, user.uid, 'Rechazada por el encargado');
      setExpandedId(null);
      setTab('rechazados');
      showSuccess(
        'Solicitud rechazada',
        'El alumno verá el rechazo en sus solicitudes.',
        loan.folio
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo rechazar.');
    } finally {
      setBusy(false);
    }
  };

  const onReturn = async (loan: Loan) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      const due = loan.dueAt ? new Date(loan.dueAt) : null;
      const late = due ? due.getTime() < Date.now() : false;
      await returnLoan(loan.id, user.uid, { late });
      setExpandedId(null);
      showSuccess(
        late ? 'Devolución con retraso' : 'Devolución registrada',
        'El material volvió al inventario del laboratorio.',
        loan.folio
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo devolver.');
    } finally {
      setBusy(false);
    }
  };

  const emptyCopy: Record<LabTab, { title: string; description: string }> = {
    solicitudes: {
      title: 'Sin solicitudes pendientes',
      description: 'Cuando un alumno pida material, aparecerá aquí para entregar o rechazar.',
    },
    aceptados: {
      title: 'Sin préstamos aceptados',
      description: 'Aquí verás los equipos ya entregados y activos.',
    },
    rechazados: {
      title: 'Sin solicitudes rechazadas',
      description: 'Las solicitudes que rechaces se listarán en este apartado.',
    },
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Panel operativo</Text>
            <Text style={styles.title}>Solicitudes</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'EN')} size={28} />
        </View>

        <View style={styles.tabs}>
          {TABS.map((item) => {
            const active = tab === item.id;
            const count = counts[item.id];
            return (
              <Pressable
                key={item.id}
                onPress={() => changeTab(item.id)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {item.label}
                </Text>
                <View style={[styles.tabCount, active && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Notice tone="danger" title="Error al cargar solicitudes" description={error} />
        ) : null}

        {actionError ? (
          <Notice tone="danger" title="No se completó la acción" description={actionError} />
        ) : null}

        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} /> : null}

        {!loading && filtered.length === 0 ? (
          <Notice title={emptyCopy[tab].title} description={emptyCopy[tab].description} />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <Text style={styles.helper}>Toca una solicitud para ver el detalle y actuar.</Text>
        ) : null}

        {filtered.map((loan) => {
          const expanded = expandedId === loan.id;
          return (
            <LabLoanItem
              key={loan.id}
              loan={loan}
              expanded={expanded}
              dimmed={expandedId !== null && !expanded}
              stock={stockById[loan.equipmentId] ?? null}
              busy={busy}
              dueDisplay={dueById[loan.id] ?? isoToDisplay(dueIsoFromLoan(loan))}
              onToggle={() => toggle(loan)}
              onDueChange={(value) =>
                setDueById((prev) => ({
                  ...prev,
                  [loan.id]: value,
                }))
              }
              onDeliver={() => onDeliver(loan)}
              onReject={() => onReject(loan)}
              onReturn={() => onReturn(loan)}
            />
          );
        })}
      </ScrollView>

      <Modal visible={successOpen} transparent animationType="fade" onRequestClose={closeSuccess}>
        <View style={styles.modalBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <MaterialIcons name="check-circle" size={42} color={theme.color.success} />
            </View>
            <Text style={styles.successTitle}>{successTitle}</Text>
            <Text style={styles.successSubtitle}>{successSubtitle}</Text>

            <View style={styles.folioBox}>
              <Text style={styles.folioLabel}>Número de pedido</Text>
              <Text style={styles.folioValue}>{successFolio ?? '—'}</Text>
            </View>

            <Button title="Entendido" onPress={closeSuccess} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvasMobile,
    paddingHorizontal: 14,
  },
  scroll: {
    paddingBottom: 32,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  hello: {
    color: theme.color.muted,
    fontSize: 11,
    marginBottom: 2,
  },
  title: {
    color: theme.color.navy,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#EEF2F6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: theme.color.surface,
    ...theme.shadow.soft,
  },
  tabLabel: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: theme.color.navy,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E6ED',
  },
  tabCountActive: {
    backgroundColor: theme.color.infoSoft,
  },
  tabCountText: {
    color: theme.color.muted,
    fontSize: 9,
    fontWeight: '800',
  },
  tabCountTextActive: {
    color: theme.color.navy,
  },
  helper: {
    marginBottom: 10,
    color: theme.color.muted,
    fontSize: 10,
  },
  cardWrap: {
    marginBottom: 10,
  },
  cardWrapActive: {
    zIndex: 2,
  },
  actionsPanel: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  sectionLabel: {
    marginBottom: 8,
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  dateField: {
    height: 40,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    color: '#536273',
    fontSize: 13,
    paddingVertical: 0,
  },
  calendarIcon: {
    color: theme.color.muted,
    fontSize: 14,
    marginLeft: 8,
  },
  dual: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 33, 43, 0.45)',
    justifyContent: 'center',
  },
  successCard: {
    marginHorizontal: 22,
    backgroundColor: theme.color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 20,
    alignItems: 'center',
  },
  successIconWrap: {
    marginBottom: 10,
  },
  successTitle: {
    color: theme.color.navy,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  successSubtitle: {
    marginTop: 6,
    color: theme.color.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  folioBox: {
    marginTop: 16,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    borderWidth: 1,
    borderColor: '#CBDCF1',
    alignItems: 'center',
  },
  folioLabel: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  folioValue: {
    marginTop: 6,
    color: theme.color.navy,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
