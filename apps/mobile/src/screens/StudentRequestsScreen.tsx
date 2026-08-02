import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
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
import { watchLoansForStudent } from '@lab-topo/services';
import { Avatar, Notice, RequestCard, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

function LoanAccordionItem({
  loan,
  expanded,
  dimmed,
  onToggle,
}: {
  loan: Loan;
  expanded: boolean;
  dimmed: boolean;
  onToggle: () => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: dimmed ? 0.38 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [dimmed, opacity]);

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        { opacity },
        expanded && styles.cardWrapActive,
      ]}
    >
      <RequestCard
        folio={`Solicitud #${loan.folio}`}
        statusLabel={loanStatusLabel(loan.status)}
        statusTone={toneForStatus(loan.status)}
        collapsible
        expanded={expanded}
        onToggle={onToggle}
        compactHint={loan.equipmentName}
        rows={[
          { label: 'Equipo', value: loan.equipmentName },
          { label: 'Profesor', value: loan.teacherName },
          { label: 'Solicitada', value: formatDateTime(loan.requestedAt) },
          {
            label: 'Devolver antes de',
            value: formatDateTime(loan.dueAt),
            valueColor: theme.color.navy,
          },
          {
            label: 'Actualización',
            value: loanStatusLabel(loan.status),
          },
        ]}
      />
    </Animated.View>
  );
}

export function StudentRequestsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = watchLoansForStudent(
      user.uid,
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

  const toggle = (id: string) => {
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
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Mis movimientos</Text>
            <Text style={styles.title}>Solicitudes</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'AL')} size={28} />
        </View>

        {!loading && loans.length > 0 ? (
          <Text style={styles.helper}>Toca una solicitud para ver el detalle.</Text>
        ) : null}

        {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 20 }} /> : null}

        {!loading && loans.length === 0 ? (
          <Notice
            title="Sin solicitudes todavía"
            description="Cuando envíes una solicitud desde el catálogo, aquí verás su estado."
          />
        ) : null}

        {loans.map((loan) => {
          const expanded = expandedId === loan.id;
          const dimmed = expandedId !== null && !expanded;
          return (
            <LoanAccordionItem
              key={loan.id}
              loan={loan}
              expanded={expanded}
              dimmed={dimmed}
              onToggle={() => toggle(loan.id)}
            />
          );
        })}
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
  helper: {
    marginBottom: 12,
    color: theme.color.muted,
    fontSize: 10,
  },
  cardWrap: {
    marginBottom: 10,
  },
  cardWrapActive: {
    zIndex: 2,
  },
});
