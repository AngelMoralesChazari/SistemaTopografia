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
import { getInitials, type Loan } from '@lab-topo/domain';
import { watchLoansForTeacher } from '@lab-topo/services';
import { Avatar, Notice } from '@lab-topo/ui';
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

  const metrics = useMemo(() => {
    const students = new Set(loans.map((l) => l.studentId));
    const pending = loans.filter((l) => l.status === 'pending' || l.status === 'approved').length;
    const inProgress = loans.filter((l) => l.status === 'delivered').length;
    const returned = loans.filter(
      (l) => l.status === 'returned' || l.status === 'returned_late'
    ).length;
    const overdue = loans.filter(isOverdue).length;
    const rejected = loans.filter((l) => l.status === 'rejected').length;

    const cards: Metric[] = [
      {
        key: 'students',
        label: 'Alumnos',
        value: students.size,
        icon: 'groups',
        tone: 'navy',
      },
      {
        key: 'pending',
        label: 'Pendientes',
        value: pending,
        icon: 'hourglass-empty',
        tone: 'info',
      },
      {
        key: 'progress',
        label: 'En curso',
        value: inProgress,
        icon: 'inventory-2',
        tone: 'warning',
      },
      {
        key: 'returned',
        label: 'Devueltos',
        value: returned,
        icon: 'check-circle',
        tone: 'success',
      },
      {
        key: 'overdue',
        label: 'Retrasados',
        value: overdue,
        icon: 'warning',
        tone: 'danger',
      },
      {
        key: 'rejected',
        label: 'Rechazados',
        value: rejected,
        icon: 'cancel',
        tone: 'danger',
      },
    ];
    return cards;
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
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Supervisión académica</Text>
            <Text style={styles.title}>Resumen</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'CR')} size={28} />
        </View>

        <Text style={styles.subtitle}>
          Indicadores de préstamos de tus alumnos en el laboratorio.
        </Text>

        {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 20 }} /> : null}

        {!loading ? (
          <View style={styles.grid}>
            {metrics.map((metric) => {
              const colors = toneStyles[metric.tone];
              return (
                <View key={metric.key} style={[styles.card, { backgroundColor: colors.bg }]}>
                  <View style={styles.cardTop}>
                    <MaterialIcons name={metric.icon} size={18} color={colors.icon} />
                    <Text style={styles.cardLabel}>{metric.label}</Text>
                  </View>
                  <Text style={[styles.cardValue, { color: colors.value }]}>{metric.value}</Text>
                </View>
              );
            })}
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
    paddingBottom: 32,
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
    marginBottom: 2,
  },
  title: {
    color: theme.color.navy,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginBottom: 16,
    color: theme.color.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 92,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardLabel: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  cardValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  hintBox: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    borderWidth: 1,
    borderColor: '#CBDCF1',
  },
  hintText: {
    flex: 1,
    color: theme.color.navy,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
