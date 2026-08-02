import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { deliverLoan, rejectLoan, returnLoan, watchLabQueue } from '@lab-topo/services';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(defaultDueDate());
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
          return next[0]?.id ?? null;
        });
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  const selected = useMemo(
    () => loans.find((l) => l.id === selectedId) ?? null,
    [loans, selectedId]
  );

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
  };

  const onDeliver = async () => {
    if (!user || !selected) return;
    setBusy(true);
    try {
      await deliverLoan(selected.id, user.uid, dueDate);
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

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Panel operativo</Text>
            <Text style={styles.title}>Solicitudes</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'EN')} size={26} />
        </View>

        {error ? <Notice tone="danger" title="Error al cargar solicitudes" description={error} /> : null}

        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 20 }} /> : null}

        {!loading && loans.length === 0 ? (
          <Notice
            title="Sin solicitudes activas"
            description="Cuando un alumno solicite material, aparecerá aquí para aprobar o rechazar."
          />
        ) : null}

        {!loading && loans.length > 0 ? (
          <>
            <Notice
              title={
                selected?.status === 'pending'
                  ? '● Nueva solicitud entrante'
                  : '● Solicitud seleccionada'
              }
              description={
                selected?.status === 'pending'
                  ? 'Revisa los datos antes de entregar el equipo al alumno.'
                  : 'Puedes registrar la devolución cuando el material regrese.'
              }
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {loans.map((loan) => {
                const active = loan.id === selectedId;
                return (
                  <Text
                    key={loan.id}
                    onPress={() => setSelectedId(loan.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    {loan.folio}
                  </Text>
                );
              })}
            </ScrollView>

            {selected ? (
              <>
                <RequestCard
                  folio={`Solicitud #${selected.folio}`}
                  statusLabel={loanStatusLabel(selected.status)}
                  statusTone={toneForStatus(selected.status)}
                  rows={[
                    { label: 'Alumno', value: selected.studentName },
                    { label: 'Matrícula', value: selected.studentNumber ?? '—' },
                    { label: 'Profesor', value: selected.teacherName },
                    { label: 'Equipo', value: selected.equipmentName },
                    {
                      label: selected.status === 'delivered' ? 'Fecha límite' : 'Estado',
                      value:
                        selected.status === 'delivered'
                          ? formatDue(selected.dueAt)
                          : loanStatusLabel(selected.status),
                      valueColor:
                        selected.status === 'pending' ? theme.color.success : theme.color.ink,
                    },
                  ]}
                />

                {(selected.status === 'pending' || selected.status === 'approved') && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                      Fecha límite de devolución
                    </Text>
                    <TextInput
                      value={dueDate}
                      onChangeText={setDueDate}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={theme.color.muted}
                      style={styles.field}
                    />
                    <View style={styles.dual}>
                      <Button
                        title="Entregar equipo"
                        loading={busy}
                        fullWidth={false}
                        style={{ flex: 1, height: 32 }}
                        onPress={onDeliver}
                      />
                      {selected.status === 'pending' ? (
                        <Button
                          title="Rechazar"
                          variant="danger"
                          loading={busy}
                          fullWidth={false}
                          style={{ flex: 1, height: 32 }}
                          onPress={onReject}
                        />
                      ) : null}
                    </View>
                  </>
                )}

                {selected.status === 'delivered' ? (
                  <View style={{ marginTop: 14 }}>
                    <Button title="Registrar devolución" loading={busy} onPress={onReturn} />
                  </View>
                ) : null}
              </>
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
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  hello: {
    color: theme.color.muted,
    fontSize: 11,
  },
  title: {
    color: theme.color.navy,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  chips: {
    marginBottom: 12,
  },
  chip: {
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EEF2F6',
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  chipActive: {
    backgroundColor: theme.color.infoSoft,
    color: theme.color.navy,
  },
  sectionLabel: {
    marginBottom: 8,
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  field: {
    height: 35,
    marginBottom: 13,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 6,
    backgroundColor: '#fff',
    color: '#536273',
    fontSize: 12,
  },
  dual: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
  },
});
