import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
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
import type { TeacherStudentsStackParamList } from '../navigation/TeacherStudentsStack';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PREVIEW_LIMIT = 2;

type StudentGroup = {
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  loans: Loan[];
};

type StudentsNav = NativeStackNavigationProp<TeacherStudentsStackParamList, 'StudentsList'>;

function toneForStatus(status: LoanStatus): BadgeTone {
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

function groupStatus(loans: Loan[]): { label: string; tone: BadgeTone } {
  const overdue = loans.some(
    (l) =>
      l.status === 'delivered' &&
      !!l.dueAt &&
      new Date(l.dueAt).getTime() < Date.now()
  );
  if (overdue) return { label: 'Retraso', tone: 'late' };
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StudentAccordionItem({
  group,
  expanded,
  dimmed,
  onToggle,
  onOpenHistory,
}: {
  group: StudentGroup;
  expanded: boolean;
  dimmed: boolean;
  onToggle: () => void;
  onOpenHistory: () => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const status = groupStatus(group.loans);
  const preview = group.loans.slice(0, PREVIEW_LIMIT);
  const extraCount = Math.max(0, group.loans.length - PREVIEW_LIMIT);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: dimmed ? 0.38 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [dimmed, opacity]);

  return (
    <Animated.View style={[styles.cardWrap, { opacity }, expanded && styles.cardWrapActive]}>
      <View style={[styles.card, expanded && styles.cardExpanded]}>
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [styles.cardHead, pressed && styles.cardPressed]}
        >
          <Avatar initials={getInitials(group.studentName)} size={28} />
          <View style={styles.cardHeadText}>
            <Text style={styles.studentName} numberOfLines={1}>
              {group.studentName}
            </Text>
            <Text style={styles.studentMeta} numberOfLines={1}>
              {group.studentNumber ? `Matrícula ${group.studentNumber}` : 'Sin matrícula'} ·{' '}
              {group.loans.length} préstamo{group.loans.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Badge label={status.label} tone={status.tone} />
          <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
        </Pressable>

        {expanded ? (
          <View style={styles.detailList}>
            {preview.map((loan) => {
              const late =
                loan.status === 'delivered' &&
                !!loan.dueAt &&
                new Date(loan.dueAt).getTime() < Date.now();
              return (
                <View key={loan.id} style={styles.loanBlock}>
                  <View style={styles.loanHead}>
                    <Text style={styles.loanFolio}>#{loan.folio}</Text>
                    <Badge
                      label={late ? 'Retrasado' : loanStatusLabel(loan.status)}
                      tone={late ? 'late' : toneForStatus(loan.status)}
                    />
                  </View>
                  <View style={styles.loanRow}>
                    <Text style={styles.loanLabel}>Equipo</Text>
                    <Text style={styles.loanValue}>{loan.equipmentName}</Text>
                  </View>
                  <View style={styles.loanRow}>
                    <Text style={styles.loanLabel}>Código</Text>
                    <Text style={styles.loanValue}>{loan.equipmentCode}</Text>
                  </View>
                  <View style={styles.loanRow}>
                    <Text style={styles.loanLabel}>Solicitada</Text>
                    <Text style={styles.loanValue}>{formatDateTime(loan.requestedAt)}</Text>
                  </View>
                  <View style={[styles.loanRow, styles.loanRowLast]}>
                    <Text style={styles.loanLabel}>Devolución</Text>
                    <Text style={[styles.loanValue, { color: theme.color.navy }]}>
                      {formatDateTime(loan.dueAt)}
                    </Text>
                  </View>
                  {late ? (
                    <View style={styles.alert}>
                      <Text style={styles.alertText}>
                        ! Contactar al alumno para coordinar la devolución.
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {group.loans.length > 0 ? (
              <Pressable
                onPress={onOpenHistory}
                style={({ pressed }) => [styles.moreBtn, pressed && styles.moreBtnPressed]}
              >
                <View style={styles.moreTextWrap}>
                  <Text style={styles.moreTitle}>
                    {extraCount > 0 ? 'Ver más detalle' : 'Ver historial'}
                  </Text>
                  <Text style={styles.moreSubtitle}>
                    {extraCount > 0
                      ? `Historial completo · ${extraCount} más`
                      : 'Buscar y filtrar por fecha'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.color.navy} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function TeacherStudentsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<StudentsNav>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const groups = useMemo((): StudentGroup[] => {
    const map = new Map<string, StudentGroup>();
    for (const loan of loans) {
      const current = map.get(loan.studentId);
      if (current) {
        current.loans.push(loan);
      } else {
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) =>
      `${g.studentName} ${g.studentNumber ?? ''}`.toLowerCase().includes(q)
    );
  }, [groups, search]);

  const toggle = (studentId: string) => {
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
    setExpandedId((current) => (current === studentId ? null : studentId));
  };

  const openHistory = (group: StudentGroup) => {
    navigation.navigate('StudentHistory', {
      studentId: group.studentId,
      studentName: group.studentName,
      studentNumber: group.studentNumber,
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Supervisión académica</Text>
            <Text style={styles.title}>Alumnos</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'CR')} size={28} />
        </View>

        <View style={styles.search}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar alumno o matrícula..."
            placeholderTextColor={theme.color.muted}
            style={styles.searchInput}
          />
        </View>

        {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 16 }} /> : null}

        {!loading ? (
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionTitle}>Alumnos con préstamos</Text>
            <Text style={styles.sectionCount}>{filtered.length}</Text>
          </View>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <Notice
            title="Sin alumnos todavía"
            description="Cuando tus alumnos soliciten material, aparecerán aquí."
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <Text style={styles.helper}>Toca un alumno para ver el material reciente.</Text>
        ) : null}

        {filtered.map((group) => {
          const expanded = expandedId === group.studentId;
          return (
            <StudentAccordionItem
              key={group.studentId}
              group={group}
              expanded={expanded}
              dimmed={expandedId !== null && !expanded}
              onToggle={() => toggle(group.studentId)}
              onOpenHistory={() => openHistory(group)}
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
  search: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    marginBottom: 12,
    backgroundColor: '#F3F5F7',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 6,
  },
  searchIcon: {
    color: theme.color.muted,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    color: theme.color.ink,
    fontSize: 12,
    paddingVertical: 0,
  },
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  sectionCount: {
    color: theme.color.info,
    fontSize: 10,
    fontWeight: '700',
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
  card: {
    padding: 12,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
  },
  cardExpanded: {
    borderColor: '#C5D8F0',
    backgroundColor: '#FCFDFF',
    ...theme.shadow.soft,
  },
  cardPressed: {
    backgroundColor: '#F7FAFD',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeadText: {
    flex: 1,
    minWidth: 0,
  },
  studentName: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  studentMeta: {
    marginTop: 2,
    color: theme.color.muted,
    fontSize: 10,
  },
  chevron: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  detailList: {
    marginTop: 12,
    gap: 10,
  },
  loanBlock: {
    padding: 10,
    borderRadius: 8,
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
    fontSize: 11,
    fontWeight: '800',
  },
  loanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F5F7',
  },
  loanRowLast: {
    borderBottomWidth: 0,
  },
  loanLabel: {
    color: theme.color.muted,
    fontSize: 11,
  },
  loanValue: {
    flex: 1,
    color: theme.color.ink,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  alert: {
    marginTop: 8,
    padding: 6,
    borderRadius: 5,
    backgroundColor: theme.color.redSoft,
  },
  alertText: {
    color: theme.color.red,
    fontSize: 10,
    lineHeight: 14,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5D8F0',
    backgroundColor: theme.color.infoSoft,
  },
  moreBtnPressed: {
    opacity: 0.85,
  },
  moreTextWrap: {
    flex: 1,
  },
  moreTitle: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  moreSubtitle: {
    marginTop: 2,
    color: theme.color.muted,
    fontSize: 10,
  },
});
