import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import {
  getInitials,
  loanStatusLabel,
  type Loan,
  type LoanStatus,
} from '@lab-topo/domain';
import { watchLoansForStudent } from '@lab-topo/services';
import { Avatar, Notice, RequestCard, type BadgeTone } from '@lab-topo/ui';
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

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function StudentRequestsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Mis movimientos</Text>
            <Text style={styles.title}>Solicitudes</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'AL')} size={26} />
        </View>

        {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} /> : null}

        {!loading && loans.length === 0 ? (
          <Notice
            title="Sin solicitudes todavía"
            description="Cuando envíes una solicitud desde el catálogo, aquí verás su estado."
          />
        ) : null}

        {loans.map((loan) => (
          <View key={loan.id} style={styles.cardWrap}>
            <RequestCard
              folio={`Solicitud #${loan.folio}`}
              statusLabel={loanStatusLabel(loan.status)}
              statusTone={toneForStatus(loan.status)}
              rows={[
                { label: 'Equipo', value: loan.equipmentName },
                { label: 'Profesor', value: loan.teacherName },
                { label: 'Solicitada', value: formatDate(loan.requestedAt) },
                {
                  label: loan.status === 'delivered' ? 'Devolver antes de' : 'Actualización',
                  value:
                    loan.status === 'delivered'
                      ? formatDate(loan.dueAt)
                      : loanStatusLabel(loan.status),
                },
              ]}
            />
          </View>
        ))}
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
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  hello: {
    color: theme.color.muted,
    fontSize: 11,
  },
  title: {
    color: theme.color.navy,
    fontSize: 18,
    fontWeight: '800',
  },
  cardWrap: {
    marginBottom: 12,
  },
});
