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
import { Avatar, Button, Notice, RequestCard, Toast, type BadgeTone } from '@lab-topo/ui';
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

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

/** ISO AAAA-MM-DD → DD/MM/AAAA */
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** DD/MM/AAAA o AAAA-MM-DD → AAAA-MM-DD */
function displayToIso(value: string): string {
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) return value.trim();
  return value.trim();
}

function formatDue(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function LabRequestsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stockById, setStockById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [dueDisplay, setDueDisplay] = useState(isoToDisplay(defaultDueDate()));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = watchLabQueue(
      user.labId,
      (next) => {
        setLoans(next);
        setLoading(false);
        setError(null);
        setSelectedId((current) => {
          if (current && next.some((l) => l.id === current)) return current;
          const pending = next.find((l) => l.status === 'pending' || l.status === 'approved');
          return pending?.id ?? next[0]?.id ?? null;
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

  const selected = useMemo(
    () => loans.find((l) => l.id === selectedId) ?? null,
    [loans, selectedId]
  );

  useEffect(() => {
    if (!selected?.dueAt) return;
    const d = new Date(selected.dueAt);
    if (Number.isNaN(d.getTime())) return;
    const iso = d.toISOString().slice(0, 10);
    setDueDate(iso);
    setDueDisplay(isoToDisplay(iso));
  }, [selected?.id, selected?.dueAt]);

  const syncDue = (iso: string) => {
    setDueDate(iso);
    setDueDisplay(isoToDisplay(iso));
  };

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
  };

  const onDeliver = async () => {
    if (!user || !selected) return;
    const iso = displayToIso(dueDisplay);
    setBusy(true);
    try {
      await deliverLoan(selected.id, user.uid, iso);
      syncDue(defaultDueDate());
      showToast('Equipo entregado. La solicitud ahora está activa.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo entregar.');
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!user || !selected) return;
    setBusy(true);
    try {
      await rejectLoan(selected.id, user.uid, 'Rechazada por el encargado');
      showToast('Solicitud rechazada. Se notificará al alumno.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo rechazar.');
    } finally {
      setBusy(false);
    }
  };

  const onReturn = async () => {
    if (!user || !selected) return;
    setBusy(true);
    try {
      const due = selected.dueAt ? new Date(selected.dueAt) : null;
      const late = due ? due.getTime() < Date.now() : false;
      await returnLoan(selected.id, user.uid, { late });
      showToast(late ? 'Devolución registrada con retraso.' : 'Devolución registrada.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo devolver.');
    } finally {
      setBusy(false);
    }
  };

  const available = selected ? (stockById[selected.equipmentId] ?? null) : null;
  const canManage =
    selected?.status === 'pending' || selected?.status === 'approved';

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

        {error ? <Notice tone="danger" title="Error al cargar solicitudes" description={error} /> : null}

        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} /> : null}

        {!loading && loans.length === 0 ? (
          <Notice
            title="Sin solicitudes activas"
            description="Cuando un alumno solicite material, aparecerá aquí para entregar o rechazar."
          />
        ) : null}

        {!loading && loans.length > 0 && selected ? (
          <>
            <Notice
              title={
                selected.status === 'pending'
                  ? '● Nueva solicitud entrante'
                  : selected.status === 'delivered'
                    ? '● Préstamo en curso'
                    : '● Solicitud seleccionada'
              }
              description={
                selected.status === 'pending'
                  ? 'Revisa los datos antes de entregar el equipo al alumno.'
                  : selected.status === 'delivered'
                    ? 'Registra la devolución cuando el material regrese al laboratorio.'
                    : 'Revisa el detalle y continúa con la acción correspondiente.'
              }
            />

            {loans.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
                style={styles.chips}
              >
                {loans.map((loan) => {
                  const active = loan.id === selectedId;
                  return (
                    <Pressable
                      key={loan.id}
                      onPress={() => setSelectedId(loan.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {loan.folio}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <RequestCard
              folio={`Solicitud #${selected.folio}`}
              statusLabel={loanStatusLabel(selected.status)}
              statusTone={toneForStatus(selected.status)}
              rows={[
                { label: 'Alumno', value: selected.studentName },
                { label: 'Matrícula', value: selected.studentNumber ?? '—' },
                { label: 'Profesor', value: selected.teacherName },
                { label: 'Equipo', value: selected.equipmentName },
                selected.status === 'delivered'
                  ? {
                      label: 'Fecha límite',
                      value: formatDue(selected.dueAt),
                      valueColor: theme.color.ink,
                    }
                  : {
                      label: 'Existencia',
                      value:
                        available == null
                          ? '—'
                          : `${available} disponible${available === 1 ? '' : 's'}`,
                      valueColor: theme.color.success,
                    },
              ]}
            />

            {canManage ? (
              <>
                <Text style={styles.sectionLabel}>Fecha límite de devolución</Text>
                <View style={styles.dateField}>
                  <TextInput
                    value={dueDisplay}
                    onChangeText={(text) => {
                      setDueDisplay(text);
                      const iso = displayToIso(text);
                      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) setDueDate(iso);
                    }}
                    onBlur={() => {
                      const iso = displayToIso(dueDisplay);
                      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) syncDue(iso);
                    }}
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
                  {selected.status === 'pending' ? (
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
              </>
            ) : null}

            {selected.status === 'delivered' ? (
              <View style={styles.returnWrap}>
                <Button title="Registrar devolución" loading={busy} onPress={onReturn} />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <Toast message={toast} visible={toastVisible} />
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
    marginBottom: 4,
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
  chips: {
    marginBottom: 4,
    marginTop: -4,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#EEF2F6',
  },
  chipActive: {
    backgroundColor: theme.color.infoSoft,
  },
  chipText: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  chipTextActive: {
    color: theme.color.navy,
  },
  sectionLabel: {
    marginTop: 16,
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
  returnWrap: {
    marginTop: 16,
  },
});
