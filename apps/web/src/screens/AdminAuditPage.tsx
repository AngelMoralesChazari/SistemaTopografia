import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';
import { formatRole, isSuperAdminRole, type UserRole } from '@lab-topo/domain';
import { watchAuditLogs, type AuditLogEntry } from '@lab-topo/services';
import { Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { ListPagination } from '../components/ListPagination';
import { paginate } from '../lib/pagination';

function formatDate(value: string | null): string {
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

export function AdminAuditPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyOtherAdmins, setOnlyOtherAdmins] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user || !isSuperAdminRole(user.role)) return;
    const unsub = watchAuditLogs(
      (next) => {
        setEntries(next);
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

  const visible = useMemo(() => {
    if (!user) return [];
    return entries.filter((e) => {
      const isAdminActor = e.actorRole === 'admin' || e.actorRole === 'super_admin';
      if (!isAdminActor) return false;
      if (onlyOtherAdmins && e.actorId === user.uid) return false;
      return true;
    });
  }, [entries, onlyOtherAdmins, user]);

  useEffect(() => {
    setPage(1);
  }, [onlyOtherAdmins]);

  const paging = useMemo(() => paginate(visible, page), [visible, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  if (!user || !isSuperAdminRole(user.role)) {
    return (
      <View style={styles.root}>
        <Notice tone="danger" title="Solo el superadministrador puede ver esta bitácora." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Auditoría de administradores</Text>
      <Text style={styles.subtitle}>
        Movimientos del administrador operativo (y otros admins) para supervisión y control.
      </Text>

      <Pressable
        onPress={() => setOnlyOtherAdmins((v) => !v)}
        style={[styles.toggle, onlyOtherAdmins && styles.toggleOn]}
      >
        <Text style={[styles.toggleText, onlyOtherAdmins && styles.toggleTextOn]}>
          {onlyOtherAdmins
            ? 'Mostrando acciones de otros administradores'
            : 'Mostrando todas las acciones de admins (incluyéndote)'}
        </Text>
      </Pressable>

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : visible.length === 0 ? (
        <Notice
          title="Sin registros"
          description="Cuando un administrador cambie una decisión o gestione préstamos, aparecerán aquí."
        />
      ) : (
        <>
          {paging.pageItems.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <Text style={styles.when}>{formatDate(entry.createdAt)}</Text>
              <Text style={styles.summary}>{entry.summary}</Text>
              <Text style={styles.meta}>
                {entry.actorName} · {entry.actorEmail} ·{' '}
                {formatRole(entry.actorRole as UserRole)}
              </Text>
              <Text style={styles.meta}>
                {entry.action} · {entry.targetType}/{entry.targetId}
                {entry.before || entry.after
                  ? ` · ${entry.before ?? '—'} → ${entry.after ?? '—'}`
                  : ''}
              </Text>
            </View>
          ))}
          <ListPagination
            page={paging.page}
            totalPages={paging.totalPages}
            from={paging.from}
            to={paging.to}
            total={paging.total}
            pageNumbers={paging.pageNumbers}
            onChange={setPage}
          />
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
  toggle: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
    marginBottom: 16,
  },
  toggleOn: { backgroundColor: theme.color.infoSoft, borderColor: theme.color.navy },
  toggleText: { color: theme.color.muted, fontWeight: '700', fontSize: 13 },
  toggleTextOn: { color: theme.color.navy },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.soft,
  },
  when: { color: theme.color.muted, fontSize: 11, fontWeight: '700' },
  summary: { marginTop: 6, color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.md },
  meta: { marginTop: 4, color: theme.color.muted, fontSize: 12 },
});
