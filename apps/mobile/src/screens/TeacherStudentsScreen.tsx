import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import { getInitials, type Loan } from '@lab-topo/domain';
import { watchLoansForTeacher } from '@lab-topo/services';
import { Avatar, Notice, StudentLoanRow } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

function formatDue(loan: Loan): string {
  if (!loan.dueAt) return 'Sin fecha';
  const due = new Date(loan.dueAt);
  if (Number.isNaN(due.getTime())) return 'Sin fecha';
  const label = due.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  if (loan.status === 'delivered' && due.getTime() < Date.now()) {
    return `Venció ${label}`;
  }
  return `Devuelve ${label}`;
}

export function TeacherStudentsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
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

  const overdueCount = loans.filter(
    (l) => l.status === 'delivered' && l.dueAt && new Date(l.dueAt).getTime() < Date.now()
  ).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return loans;
    return loans.filter((loan) =>
      `${loan.studentName} ${loan.studentNumber ?? ''} ${loan.equipmentName}`.toLowerCase().includes(q)
    );
  }, [loans, search]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Supervisión académica</Text>
            <Text style={styles.title}>Mis alumnos</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'CR')} size={26} />
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

        {overdueCount > 0 ? (
          <Notice
            tone="danger"
            title={`! ${overdueCount} préstamo${overdueCount > 1 ? 's' : ''} requiere atención`}
            description="Consulta el material retrasado de tu grupo."
          />
        ) : null}

        {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} /> : null}

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Préstamos vigentes</Text>
          <Text style={styles.sectionCount}>{filtered.length} registros</Text>
        </View>

        {!loading && filtered.length === 0 ? (
          <Notice
            title="Sin préstamos vigentes"
            description="Cuando tus alumnos tengan solicitudes activas, aparecerán aquí."
          />
        ) : null}

        {filtered.map((loan) => {
          const late =
            loan.status === 'delivered' &&
            !!loan.dueAt &&
            new Date(loan.dueAt).getTime() < Date.now();
          return (
            <StudentLoanRow
              key={loan.id}
              name={loan.studentName}
              initials={getInitials(loan.studentName)}
              equipmentName={loan.equipmentName}
              dueLabel={formatDue(loan)}
              statusLabel={late ? 'Retrasado' : loan.status === 'delivered' ? 'En curso' : 'Pendiente'}
              statusTone={late ? 'late' : loan.status === 'delivered' ? 'ok' : 'pending'}
              alertText={late ? 'Contactar al alumno para coordinar devolución.' : undefined}
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
    letterSpacing: -0.4,
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
    marginTop: 8,
    marginBottom: 4,
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
});
