import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import { RENTER_STATUS_LABELS, type AppUser, type RenterStatus } from '@lab-topo/domain';
import { setRenterStatus, watchRenters } from '@lab-topo/services';
import { Button, Notice, Toast } from '@lab-topo/ui';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export function RentersScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const unsub = watchRenters(
      (next) => {
        setItems(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((u) => u.renterStatus === filter);
  }, [items, filter]);

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
  };

  const onSetStatus = async (
    userId: string,
    status: Extract<RenterStatus, 'approved' | 'rejected'>
  ) => {
    setBusyId(userId);
    try {
      await setRenterStatus(userId, status);
      showToast(status === 'approved' ? 'Particular aprobado.' : 'Registro rechazado.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo actualizar.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Particulares</Text>
        <Text style={styles.subtitle}>Aprueba o rechaza registros de renta.</Text>

        <View style={styles.tabs}>
          {(
            [
              ['pending', 'Pendientes'],
              ['approved', 'Aprobados'],
              ['rejected', 'Rechazados'],
              ['all', 'Todos'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              style={[styles.tab, filter === id && styles.tabActive]}
            >
              <Text style={[styles.tabText, filter === id && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Notice tone="danger" title={error} /> : null}
        {loading ? (
          <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
        ) : filtered.length === 0 ? (
          <Notice
            title="Sin registros"
            description={
              filter === 'pending'
                ? 'No hay particulares esperando aprobación.'
                : 'No hay particulares en este filtro.'
            }
          />
        ) : (
          filtered.map((renter) => (
            <View key={renter.uid} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{renter.displayName}</Text>
                  <Text style={styles.email}>{renter.email}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>
                    {RENTER_STATUS_LABELS[renter.renterStatus ?? 'pending']}
                  </Text>
                </View>
              </View>

              {[
                ['Teléfono', renter.phone],
                ['Empresa', renter.company],
                ['INE', renter.ine],
                ['RFC', renter.rfc],
                ['Dirección', renter.address],
              ].map(([label, value]) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldValue}>{value || '—'}</Text>
                </View>
              ))}

              {renter.renterStatus === 'pending' ? (
                <View style={styles.actions}>
                  <Button
                    title="Aprobar"
                    fullWidth={false}
                    style={styles.actionBtn}
                    loading={busyId === renter.uid}
                    disabled={busyId === renter.uid}
                    onPress={() => onSetStatus(renter.uid, 'approved')}
                  />
                  <Button
                    title="Rechazar"
                    variant="secondary"
                    fullWidth={false}
                    style={styles.actionBtn}
                    disabled={busyId === renter.uid}
                    onPress={() => onSetStatus(renter.uid, 'rejected')}
                  />
                </View>
              ) : null}

              {renter.renterStatus === 'rejected' ? (
                <Pressable
                  style={styles.reopen}
                  disabled={busyId === renter.uid}
                  onPress={() => onSetStatus(renter.uid, 'approved')}
                >
                  <MaterialIcons name="check-circle-outline" size={18} color={theme.color.navy} />
                  <Text style={styles.reopenText}>Aprobar de todas formas</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
      <Toast message={toast} visible={toastVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvasMobile },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { color: theme.color.navy, fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 6, marginBottom: 14, color: theme.color.muted, fontSize: 13 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  tabActive: { backgroundColor: theme.color.infoSoft, borderColor: theme.color.navy },
  tabText: { color: theme.color.muted, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: theme.color.navy },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.soft,
  },
  cardHead: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  name: { color: theme.color.navy, fontSize: 16, fontWeight: '800' },
  email: { color: theme.color.muted, marginTop: 2, fontSize: 12 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.color.infoSoft,
    alignSelf: 'flex-start',
  },
  statusText: { color: theme.color.navy, fontSize: 10, fontWeight: '800' },
  field: { marginBottom: 6 },
  fieldLabel: { color: theme.color.muted, fontSize: 10, fontWeight: '700' },
  fieldValue: { color: theme.color.ink, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1 },
  reopen: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  reopenText: { color: theme.color.navy, fontWeight: '700', fontSize: 13 },
});
