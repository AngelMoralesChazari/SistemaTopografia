import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import {
  formatRole,
  isAdminRole,
  type AppUser,
  type UserRole,
} from '@lab-topo/domain';
import { watchLabUsers } from '@lab-topo/services';
import { Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

type RoleFilter = 'all' | UserRole;

const ROLE_ORDER: UserRole[] = [
  'super_admin',
  'admin',
  'lab_manager',
  'teacher',
  'student',
  'renter',
];

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return;
    const unsub = watchLabUsers(
      (next) => {
        setUsers(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      user.labId
    );
    return unsub;
  }, [user]);

  const filtered = useMemo(() => {
    const list = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter);
    return [...list].sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(a.role);
      const rb = ROLE_ORDER.indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return a.displayName.localeCompare(b.displayName, 'es');
    });
  }, [users, roleFilter]);

  const teachers = useMemo(() => users.filter((u) => u.role === 'teacher'), [users]);
  const studentsOfTeacher = useMemo(() => {
    if (!selectedTeacherId) return [];
    return users.filter((u) => u.role === 'student' && u.teacherId === selectedTeacherId);
  }, [users, selectedTeacherId]);

  const selectedTeacher = teachers.find((t) => t.uid === selectedTeacherId) ?? null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Usuarios del laboratorio</Text>
      <Text style={styles.subtitle}>
        Administradores, encargados, maestros, alumnos y particulares.
      </Text>

      <View style={styles.filters}>
        <Pressable
          onPress={() => setRoleFilter('all')}
          style={[styles.chip, roleFilter === 'all' && styles.chipActive]}
        >
          <Text style={[styles.chipText, roleFilter === 'all' && styles.chipTextActive]}>Todos</Text>
        </Pressable>
        {ROLE_ORDER.map((role) => (
          <Pressable
            key={role}
            onPress={() => setRoleFilter(role)}
            style={[styles.chip, roleFilter === role && styles.chipActive]}
          >
            <Text style={[styles.chipText, roleFilter === role && styles.chipTextActive]}>
              {formatRole(role)}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : (
        <>
          {filtered.map((u) => (
            <View key={u.uid} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{u.displayName}</Text>
                  <Text style={styles.email}>{u.email}</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{formatRole(u.role)}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {u.active ? 'Activo' : 'Inactivo'}
                {u.employeeId ? ` · ${u.employeeId}` : ''}
                {u.studentId ? ` · Mat. ${u.studentId}` : ''}
                {u.teacherName ? ` · Prof. ${u.teacherName}` : ''}
                {u.renterStatus ? ` · Renta: ${u.renterStatus}` : ''}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Maestros y sus alumnos</Text>
          <Text style={styles.subtitle}>Selecciona un maestro para ver su grupo.</Text>
          <View style={styles.filters}>
            {teachers.map((t) => (
              <Pressable
                key={t.uid}
                onPress={() => setSelectedTeacherId(t.uid)}
                style={[styles.chip, selectedTeacherId === t.uid && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedTeacherId === t.uid && styles.chipTextActive,
                  ]}
                >
                  {t.displayName}
                </Text>
              </Pressable>
            ))}
          </View>
          {selectedTeacher ? (
            <View style={styles.card}>
              <Text style={styles.name}>{selectedTeacher.displayName}</Text>
              <Text style={styles.email}>{selectedTeacher.email}</Text>
              <Text style={[styles.meta, { marginTop: 10 }]}>
                {studentsOfTeacher.length} alumno(s) asignado(s)
              </Text>
              {studentsOfTeacher.length === 0 ? (
                <Text style={styles.empty}>Sin alumnos vinculados.</Text>
              ) : (
                studentsOfTeacher.map((s) => (
                  <View key={s.uid} style={styles.studentRow}>
                    <Text style={styles.studentName}>{s.displayName}</Text>
                    <Text style={styles.studentMeta}>
                      {s.studentId ?? '—'} · {s.email}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 28, paddingBottom: 48 },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: { marginTop: 8, marginBottom: 14, color: theme.color.muted, fontSize: theme.font.size.md },
  sectionTitle: {
    marginTop: 24,
    color: theme.color.navy,
    fontSize: theme.font.size.xl,
    fontWeight: '800',
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  chipActive: { backgroundColor: theme.color.infoSoft, borderColor: theme.color.navy },
  chipText: { color: theme.color.muted, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: theme.color.navy },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.soft,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  name: { color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.md },
  email: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.color.infoSoft,
  },
  pillText: { color: theme.color.navy, fontSize: 10, fontWeight: '800' },
  meta: { marginTop: 8, color: theme.color.muted, fontSize: 12 },
  empty: { marginTop: 8, color: theme.color.muted },
  studentRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  studentName: { color: theme.color.ink, fontWeight: '700' },
  studentMeta: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
});
