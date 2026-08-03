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
  loanStatusLabel,
  type Loan,
  type LoanStatus,
} from '@lab-topo/domain';
import { deliverLoan, rejectLoan, returnLoan, watchLabQueue } from '@lab-topo/services';
import { Badge, Button, Notice, type BadgeTone } from '@lab-topo/ui';
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

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RequestsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'lab_manager';
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const kpis = useMemo(() => {
    const pending = loans.filter((l) => l.status === 'pending').length;
    const delivered = loans.filter((l) => l.status === 'delivered').length;
    const overdue = loans.filter(
      (l) => l.status === 'delivered' && l.dueAt && new Date(l.dueAt).getTime() < Date.now()
    ).length;
    return { pending, delivered, overdue, total: loans.length };
  }, [loans]);

  const runAction = async (action: () => Promise<void>, okMessage: string) => {
    if (!user || !canManage) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(okMessage);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Solicitudes activas</Text>
          <Text style={styles.subtitle}>
            Cola en tiempo real del laboratorio · sincronizada con la app móvil
          </Text>
        </View>
      </View>

      <View style={styles.kpis}>
        {[
          { label: 'Pendientes', value: String(kpis.pending) },
          { label: 'En préstamo', value: String(kpis.delivered) },
          { label: 'Activas', value: String(kpis.total) },
          { label: 'Con retraso', value: String(kpis.overdue), alert: kpis.overdue > 0 },
        ].map((kpi) => (
          <View key={kpi.label} style={[styles.kpi, kpi.alert && styles.kpiAlert]}>
            <Text style={[styles.kpiLabel, kpi.alert && styles.kpiLabelAlert]}>{kpi.label}</Text>
            <Text style={[styles.kpiValue, kpi.alert && styles.kpiValueAlert]}>{kpi.value}</Text>
          </View>
        ))}
      </View>

      {message ? <Notice title={message} /> : null}
      {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
      {loading ? <ActivityIndicator color={theme.color.navy} /> : null}

      {!loading && loans.length === 0 ? (
        <Notice
          title="Sin solicitudes activas"
          description="Cuando un alumno solicite material desde el teléfono, aparecerá aquí."
        />
      ) : null}

      <View style={styles.workspace}>
        <View style={styles.listCard}>
          <Text style={styles.cardTitle}>Cola operativa</Text>
          {loans.map((loan) => {
            const active = loan.id === selectedId;
            return (
              <Pressable
                key={loan.id}
                onPress={() => setSelectedId(loan.id)}
                style={[styles.row, active && styles.rowActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowFolio}>{loan.folio}</Text>
                  <Text style={styles.rowName}>{loan.studentName}</Text>
                  <Text style={styles.rowMeta}>
                    {loan.equipmentName} · {formatDate(loan.requestedAt)}
                  </Text>
                </View>
                <Badge label={loanStatusLabel(loan.status)} tone={toneForStatus(loan.status)} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.cardTitle}>Detalle</Text>
          {!selected ? (
            <Text style={styles.emptyDetail}>Selecciona una solicitud de la cola.</Text>
          ) : (
            <>
              <View style={styles.detailHead}>
                <Text style={styles.detailFolio}>#{selected.folio}</Text>
                <Badge
                  label={loanStatusLabel(selected.status)}
                  tone={toneForStatus(selected.status)}
                />
              </View>

              {[
                ['Alumno', selected.studentName],
                ['Matrícula', selected.studentNumber ?? '—'],
                ['Profesor', selected.teacherName],
                ['Equipo', selected.equipmentName],
                ['Código', selected.equipmentCode],
                ['Solicitada', formatDate(selected.requestedAt)],
                ['Fecha límite', formatDate(selected.dueAt)],
              ].map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}

              {canManage && (selected.status === 'pending' || selected.status === 'approved') ? (
                <View style={styles.actions}>
                  <Text style={styles.fieldLabel}>Fecha límite de devolución</Text>
                  <TextInput
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="AAAA-MM-DD"
                    style={styles.input}
                  />
                  <View style={styles.actionRow}>
                    <Button
                      title="Entregar equipo"
                      loading={busy}
                      fullWidth={false}
                      style={{ flex: 1 }}
                      onPress={() =>
                        runAction(
                          () => deliverLoan(selected.id, user!.uid, dueDate),
                          'Equipo entregado correctamente.'
                        )
                      }
                    />
                    {selected.status === 'pending' ? (
                      <Button
                        title="Rechazar"
                        variant="danger"
                        loading={busy}
                        fullWidth={false}
                        style={{ flex: 1 }}
                        onPress={() =>
                          runAction(
                            () => rejectLoan(selected.id, user!.uid, 'Rechazada desde web'),
                            'Solicitud rechazada.'
                          )
                        }
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}

              {canManage && selected.status === 'delivered' ? (
                <View style={styles.actions}>
                  <Button
                    title="Registrar devolución"
                    loading={busy}
                    onPress={() => {
                      const late = selected.dueAt
                        ? new Date(selected.dueAt).getTime() < Date.now()
                        : false;
                      return runAction(
                        () => returnLoan(selected.id, user!.uid, { late }),
                        late ? 'Devuelto con retraso.' : 'Devolución registrada.'
                      );
                    }}
                  />
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 32, paddingBottom: 48 },
  header: { marginBottom: 20 },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: { marginTop: 8, color: theme.color.muted, fontSize: theme.font.size.md },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  kpi: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 100,
    padding: 16,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
  },
  kpiAlert: { backgroundColor: theme.color.red, borderColor: theme.color.red },
  kpiLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  kpiLabelAlert: { color: '#FFE2E7' },
  kpiValue: {
    marginTop: 12,
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
  },
  kpiValueAlert: { color: '#fff' },
  workspace: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  listCard: {
    flexGrow: 1,
    flexBasis: 360,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 18,
  },
  detailCard: {
    flexGrow: 1,
    flexBasis: 320,
    maxWidth: 460,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 18,
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  rowActive: { backgroundColor: '#F5F9FF' },
  rowFolio: { color: theme.color.muted, fontSize: theme.font.size.sm, fontWeight: '700' },
  rowName: { color: theme.color.ink, fontSize: theme.font.size.lg, fontWeight: '700', marginTop: 2 },
  rowMeta: { color: theme.color.muted, fontSize: theme.font.size.md, marginTop: 2 },
  emptyDetail: { color: theme.color.muted, fontSize: theme.font.size.md },
  detailHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailFolio: { color: theme.color.navy, fontSize: theme.font.size.xl, fontWeight: '800' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  detailLabel: { color: theme.color.muted, fontSize: theme.font.size.md },
  detailValue: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  actions: { marginTop: 16, gap: 10 },
  fieldLabel: {
    color: theme.color.navy,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    color: theme.color.ink,
    backgroundColor: '#fff',
    fontSize: theme.font.size.md,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
});
