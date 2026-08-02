import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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

type Props = NativeStackScreenProps<TeacherStudentsStackParamList, 'StudentHistory'>;

type DateField = 'from' | 'to' | null;

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

function formatDateOnly(value: Date | null): string {
  if (!value) return 'Cualquiera';
  return value.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function LoanHistoryCard({ loan }: { loan: Loan }) {
  const late =
    loan.status === 'delivered' &&
    !!loan.dueAt &&
    new Date(loan.dueAt).getTime() < Date.now();

  return (
    <View style={styles.loanBlock}>
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
    </View>
  );
}

export function TeacherStudentHistoryScreen({ navigation, route }: Props) {
  const { studentId, studentName, studentNumber } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialQuery, setMaterialQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [picking, setPicking] = useState<DateField>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = watchLoansForTeacher(
      user.uid,
      (next) => {
        setLoans(next.filter((l) => l.studentId === studentId));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user, studentId]);

  const filtered = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    const fromTs = dateFrom ? startOfDay(dateFrom).getTime() : null;
    const toTs = dateTo ? endOfDay(dateTo).getTime() : null;

    return loans.filter((loan) => {
      if (q) {
        const hay = `${loan.equipmentName} ${loan.equipmentCode} ${loan.folio}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (fromTs !== null || toTs !== null) {
        if (!loan.requestedAt) return false;
        const ts = new Date(loan.requestedAt).getTime();
        if (Number.isNaN(ts)) return false;
        if (fromTs !== null && ts < fromTs) return false;
        if (toTs !== null && ts > toTs) return false;
      }

      return true;
    });
  }, [loans, materialQuery, dateFrom, dateTo]);

  const onPickDate = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPicking(null);
    }
    if (event.type === 'dismissed' || !date || !picking) return;

    if (picking === 'from') {
      setDateFrom(date);
      if (dateTo && date > dateTo) setDateTo(date);
    } else {
      setDateTo(date);
      if (dateFrom && date < dateFrom) setDateFrom(date);
    }
  };

  const clearFilters = () => {
    setMaterialQuery('');
    setDateFrom(null);
    setDateTo(null);
    setPicking(null);
  };

  const hasFilters = Boolean(materialQuery.trim() || dateFrom || dateTo);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <MaterialIcons name="arrow-back" size={20} color={theme.color.navy} />
          </Pressable>
          <View style={styles.topText}>
            <Text style={styles.hello}>Historial de préstamos</Text>
            <Text style={styles.title} numberOfLines={1}>
              {studentName}
            </Text>
          </View>
          <Avatar initials={getInitials(studentName)} size={28} />
        </View>

        <Text style={styles.meta}>
          {studentNumber ? `Matrícula ${studentNumber}` : 'Sin matrícula'} · {loans.length}{' '}
          registro{loans.length === 1 ? '' : 's'}
        </Text>

        <View style={styles.search}>
          <MaterialIcons name="search" size={16} color={theme.color.muted} />
          <TextInput
            value={materialQuery}
            onChangeText={setMaterialQuery}
            placeholder="Buscar por nombre de material..."
            placeholderTextColor={theme.color.muted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.dateRow}>
          <Pressable
            onPress={() => setPicking('from')}
            style={[styles.dateField, picking === 'from' && styles.dateFieldActive]}
          >
            <Text style={styles.dateLabel}>Desde</Text>
            <View style={styles.dateValueRow}>
              <Text style={styles.dateValue}>{formatDateOnly(dateFrom)}</Text>
              <MaterialIcons name="event" size={16} color={theme.color.navy} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => setPicking('to')}
            style={[styles.dateField, picking === 'to' && styles.dateFieldActive]}
          >
            <Text style={styles.dateLabel}>Hasta</Text>
            <View style={styles.dateValueRow}>
              <Text style={styles.dateValue}>{formatDateOnly(dateTo)}</Text>
              <MaterialIcons name="event" size={16} color={theme.color.navy} />
            </View>
          </Pressable>
        </View>

        {picking ? (
          <View style={styles.pickerBox}>
            <DateTimePicker
              value={
                (picking === 'from' ? dateFrom : dateTo) ??
                (picking === 'from' ? dateTo : dateFrom) ??
                new Date()
              }
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickDate}
            />
            {Platform.OS === 'ios' ? (
              <Pressable onPress={() => setPicking(null)} style={styles.pickerDone}>
                <Text style={styles.pickerDoneText}>Listo</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {hasFilters ? (
          <Pressable onPress={clearFilters} style={styles.clearBtn}>
            <MaterialIcons name="filter-alt-off" size={14} color={theme.color.info} />
            <Text style={styles.clearText}>Limpiar filtros</Text>
          </Pressable>
        ) : null}

        {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 16 }} /> : null}

        {!loading ? (
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionTitle}>Material solicitado</Text>
            <Text style={styles.sectionCount}>{filtered.length}</Text>
          </View>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <Notice
            title="Sin resultados"
            description={
              hasFilters
                ? 'Prueba otro nombre o ajusta el rango de fechas.'
                : 'Este alumno aún no tiene préstamos registrados.'
            }
          />
        ) : null}

        {filtered.map((loan) => (
          <LoanHistoryCard key={loan.id} loan={loan} />
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
  scroll: {
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2F6',
  },
  topText: {
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
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  meta: {
    marginBottom: 14,
    marginLeft: 44,
    color: theme.color.muted,
    fontSize: 11,
  },
  search: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#F3F5F7',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.color.ink,
    fontSize: 12,
    paddingVertical: 0,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dateField: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  dateFieldActive: {
    borderColor: '#C5D8F0',
    backgroundColor: '#F7FAFD',
  },
  dateLabel: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  dateValue: {
    flex: 1,
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  pickerBox: {
    marginBottom: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickerDoneText: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  clearBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    paddingVertical: 4,
  },
  clearText: {
    color: theme.color.info,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
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
  loanBlock: {
    marginBottom: 10,
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
});
