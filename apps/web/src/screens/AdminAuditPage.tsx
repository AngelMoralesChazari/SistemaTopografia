import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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

type AuditFilterMode = 'all' | 'permissions' | 'others';

export function AdminAuditPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<AuditFilterMode>('all');
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

      if (filterMode === 'permissions') {
        return e.action.startsWith('PERMISSION_');
      }
      if (filterMode === 'others') {
        return e.actorId !== user.uid;
      }
      return true;
    });
  }, [entries, filterMode, user]);

  useEffect(() => {
    setPage(1);
  }, [filterMode]);

  const paging = useMemo(() => paginate(visible, page), [visible, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  if (!user || !isSuperAdminRole(user.role)) {
    return (
      <View style={styles.root}>
        <Notice tone="danger" title="Solo el administrador autorizado puede ver esta bitácora." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Auditoría de administradores</Text>
      <Text style={styles.subtitle}>
        Supervisión de movimientos administrativos: asignación de permisos temporales a encargados,
        cambios de estatus y decisiones operativas de 19258@uagro.mx y 17651@uagro.mx.
      </Text>

      {/* Filtros de auditoría */}
      <View style={styles.filtersRow}>
        <Pressable
          onPress={() => setFilterMode('all')}
          style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}
        >
          <MaterialIcons
            name="list-alt"
            size={16}
            color={filterMode === 'all' ? theme.color.navy : theme.color.muted}
          />
          <Text style={[styles.filterChipText, filterMode === 'all' && styles.filterChipTextActive]}>
            Todas las acciones
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterMode('permissions')}
          style={[styles.filterChip, filterMode === 'permissions' && styles.filterChipActive]}
        >
          <MaterialIcons
            name="verified-user"
            size={16}
            color={filterMode === 'permissions' ? '#166534' : theme.color.muted}
          />
          <Text
            style={[
              styles.filterChipText,
              filterMode === 'permissions' && [styles.filterChipTextActive, { color: '#166534' }],
            ]}
          >
            Permisos de encargado
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterMode('others')}
          style={[styles.filterChip, filterMode === 'others' && styles.filterChipActive]}
        >
          <MaterialIcons
            name="supervised-user-circle"
            size={16}
            color={filterMode === 'others' ? theme.color.navy : theme.color.muted}
          />
          <Text
            style={[styles.filterChipText, filterMode === 'others' && styles.filterChipTextActive]}
          >
            Solo otro administrador
          </Text>
        </Pressable>
      </View>

      {error ? <Notice tone="danger" title={error} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : visible.length === 0 ? (
        <Notice
          title="Sin registros"
          description={
            filterMode === 'permissions'
              ? 'Aún no se han registrado asignaciones o revocaciones de permisos a encargados.'
              : 'Cuando un administrador realice una acción operativa o asigne permisos, aparecerán aquí.'
          }
        />
      ) : (
        <>
          {paging.pageItems.map((entry) => {
            const isGrant = entry.action === 'PERMISSION_GRANT_EQUIPMENT_EDIT';
            const isRevoke = entry.action === 'PERMISSION_REVOKE_EQUIPMENT_EDIT';
            const isPermissionAction = isGrant || isRevoke;

            return (
              <View
                key={entry.id}
                style={[
                  styles.card,
                  isGrant && styles.cardGrant,
                  isRevoke && styles.cardRevoke,
                ]}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.when}>{formatDate(entry.createdAt)}</Text>
                  {isGrant && (
                    <View style={styles.grantBadge}>
                      <MaterialIcons name="vpn-key" size={13} color="#166534" />
                      <Text style={styles.grantBadgeText}>Permiso concedido</Text>
                    </View>
                  )}
                  {isRevoke && (
                    <View style={styles.revokeBadge}>
                      <MaterialIcons name="block" size={13} color="#991B1B" />
                      <Text style={styles.revokeBadgeText}>Permiso revocado</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.summary}>{entry.summary}</Text>

                <View style={styles.metaBox}>
                  <Text style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Ejecutado por: </Text>
                    <Text style={styles.metaActor}>{entry.actorName}</Text> ({entry.actorEmail}) ·{' '}
                    {formatRole(entry.actorRole as UserRole)}
                  </Text>

                  <Text style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Acción: </Text>
                    <Text style={styles.metaCode}>{entry.action}</Text> · {entry.targetType}/
                    {entry.targetId}
                    {entry.before || entry.after
                      ? ` · ${entry.before ?? '—'} → ${entry.after ?? '—'}`
                      : ''}
                  </Text>
                </View>
              </View>
            );
          })}
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
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    lineHeight: 20,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  filterChipActive: {
    borderColor: theme.color.navy,
    backgroundColor: '#EEF2FF',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.muted,
  },
  filterChipTextActive: {
    color: theme.color.navy,
    fontWeight: '800',
  },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.soft,
  },
  cardGrant: {
    borderColor: '#BBF7D0',
    backgroundColor: '#FAFCF8',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
  },
  cardRevoke: {
    borderColor: '#FECACA',
    backgroundColor: '#FCF8F8',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  when: { color: theme.color.muted, fontSize: 11, fontWeight: '700' },
  grantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  grantBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  revokeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  revokeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  summary: {
    marginTop: 8,
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: theme.font.size.md,
    lineHeight: 22,
  },
  metaBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 4,
  },
  metaRow: {
    fontSize: 12,
    color: theme.color.muted,
  },
  metaLabel: {
    fontWeight: '600',
    color: theme.color.ink,
  },
  metaActor: {
    fontWeight: '700',
    color: theme.color.navy,
  },
  metaCode: {
    fontFamily: 'monospace',
    fontWeight: '600',
    color: theme.color.ink,
  },
});
