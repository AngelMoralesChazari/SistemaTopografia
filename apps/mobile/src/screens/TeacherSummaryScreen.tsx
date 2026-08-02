import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
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
import { watchLoansForTeacher } from '@lab-topo/services';
import { Avatar, Badge, Notice, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

type Metric = {
  key: string;
  label: string;
  value: number;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  tone: 'navy' | 'info' | 'success' | 'warning' | 'danger';
};

function isOverdue(loan: Loan): boolean {
  return (
    loan.status === 'delivered' &&
    !!loan.dueAt &&
    new Date(loan.dueAt).getTime() < Date.now()
  );
}

function toneForStatus(status: LoanStatus, late: boolean): BadgeTone {
  if (late) return 'late';
  switch (status) {
    case 'pending':
    case 'approved':
      return 'pending';
    case 'delivered':
      return 'ok';
    case 'rejected':
      return 'rejected';
    case 'returned_late':
    case 'damaged':
    case 'lost':
      return 'late';
    default:
      return 'muted';
  }
}

function formatShortDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export function TeacherSummaryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = watchLoansForTeacher(
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

  const summary = useMemo(() => {
    const students = new Set(loans.map((l) => l.studentId));
    const pending = loans.filter((l) => l.status === 'pending' || l.status === 'approved').length;
    const inProgress = loans.filter((l) => l.status === 'delivered').length;
    const returned = loans.filter(
      (l) => l.status === 'returned' || l.status === 'returned_late'
    ).length;
    const overdue = loans.filter(isOverdue);
    const rejected = loans.filter((l) => l.status === 'rejected').length;

    const cards: Metric[] = [
      { key: 'students', label: 'Alumnos', value: students.size, icon: 'groups', tone: 'navy' },
      { key: 'pending', label: 'Pendientes', value: pending, icon: 'hourglass-empty', tone: 'info' },
      { key: 'progress', label: 'En curso', value: inProgress, icon: 'inventory-2', tone: 'warning' },
      { key: 'returned', label: 'Devueltos', value: returned, icon: 'check-circle', tone: 'success' },
      { key: 'overdue', label: 'Retrasados', value: overdue.length, icon: 'warning', tone: 'danger' },
      { key: 'rejected', label: 'Rechazados', value: rejected, icon: 'cancel', tone: 'danger' },
    ];

    return {
      cards,
      studentCount: students.size,
      total: loans.length,
      overdue,
      recent: loans.slice(0, 6),
    };
  }, [loans]);

  const toneStyles = {
    navy: { bg: theme.color.infoSoft, icon: theme.color.navy, value: theme.color.navy },
    info: { bg: theme.color.infoSoft, icon: theme.color.info, value: theme.color.info },
    success: {
      bg: theme.color.successSoft,
      icon: theme.color.success,
      value: theme.color.success,
    },
    warning: {
      bg: theme.color.warningSoft,
      icon: theme.color.warning,
      value: theme.color.warning,
    },
    danger: { bg: theme.color.redSoft, icon: theme.color.red, value: theme.color.red },
  } as const;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.hello}>Supervisión académica</Text>
            <Text style={styles.title}>Resumen</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'CR')} size={28} />
        </View>

        {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 16 }} /> : null}

        {!loading ? (
          <View style={styles.hero}>
            <View style={styles.heroItem}>
              <Text style={styles.heroValue}>{summary.total}</Text>
              <Text style={styles.heroLabel}>Préstamos</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroItem}>
              <Text style={styles.heroValue}>{summary.studentCount}</Text>
              <Text style={styles.heroLabel}>Alumnos</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroItem}>
              <Text
                style={[
                  styles.heroValue,
                  summary.overdue.length > 0 && { color: theme.color.red },
                ]}
              >
                {summary.overdue.length}
              </Text>
              <Text style={styles.heroLabel}>Retrasos</Text>
            </View>
          </View>
        ) : null}

        {!loading ? (
          <View style={styles.grid}>
            {summary.cards.map((metric) => {
              const colors = toneStyles[metric.tone];
              return (
                <View key={metric.key} style={[styles.card, { backgroundColor: colors.bg }]}>
                  <MaterialIcons name={metric.icon} size={14} color={colors.icon} />
                  <Text style={[styles.cardValue, { color: colors.value }]}>{metric.value}</Text>
                  <Text style={styles.cardLabel} numberOfLines={1}>
                    {metric.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {!loading && summary.overdue.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Requieren atención</Text>
              <Text style={styles.sectionCount}>{summary.overdue.length}</Text>
            </View>
            <View style={styles.listBox}>
              {summary.overdue.slice(0, 4).map((loan, index) => (
                <View
                  key={loan.id}
                  style={[styles.row, index === Math.min(summary.overdue.length, 4) - 1 && styles.rowLast]}
                >
                  <Avatar initials={getInitials(loan.studentName)} size={24} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {loan.studentName}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {loan.equipmentName}
                    </Text>
                  </View>
                  <Badge label="Retrasado" tone="late" />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!loading && summary.recent.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Actividad reciente</Text>
              <Text style={styles.sectionCount}>{summary.recent.length}</Text>
            </View>
            <View style={styles.listBox}>
              {summary.recent.map((loan, index) => {
                const late = isOverdue(loan);
                return (
                  <View
                    key={loan.id}
                    style={[
                      styles.row,
                      index === summary.recent.length - 1 && styles.rowLast,
                    ]}
                  >
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {loan.equipmentName}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {loan.studentName} · {formatShortDate(loan.requestedAt)}
                      </Text>
                    </View>
                    <Badge
                      label={late ? 'Retrasado' : loanStatusLabel(loan.status)}
                      tone={toneForStatus(loan.status, late)}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {!loading && loans.length === 0 ? (
          <Notice
            title="Sin actividad todavía"
            description="Cuando tus alumnos soliciten material, aquí verás las métricas del grupo."
          />
        ) : null}
      </ScrollView>
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
    paddingBottom: 28,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  headText: {
    flex: 1,
    minWidth: 0,
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  heroItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroValue: {
    color: theme.color.navy,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroLabel: {
    marginTop: 2,
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.color.line,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  card: {
    width: '31.5%',
    flexGrow: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  cardLabel: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  section: {
    marginBottom: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionCount: {
    color: theme.color.info,
    fontSize: 10,
    fontWeight: '700',
  },
  listBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F6',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  rowMeta: {
    marginTop: 2,
    color: theme.color.muted,
    fontSize: 10,
  },
});
