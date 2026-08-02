import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, getLabId } from '@lab-topo/config';
import {
  EQUIPMENT_STATUS_LABELS,
  getInitials,
  type Equipment,
  type EquipmentStatus,
} from '@lab-topo/domain';
import { createEquipment, watchEquipment } from '@lab-topo/services';
import { Avatar, Button, MaterialCard, Notice, TextField } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

const STATUS_OPTIONS: EquipmentStatus[] = [
  'available',
  'reserved',
  'loaned',
  'maintenance',
  'damaged',
  'out_of_service',
  'lost',
];

export function InventoryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [categoryName, setCategoryName] = useState('Topografía');
  const [status, setStatus] = useState<EquipmentStatus>('available');
  const [qtyTotal, setQtyTotal] = useState('1');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const unsub = watchEquipment(
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
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => {
      const hay = `${e.name} ${e.internalCode} ${e.status} ${e.categoryName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const resetForm = () => {
    setCode('');
    setName('');
    setBrand('');
    setModel('');
    setCategoryName('Topografía');
    setStatus('available');
    setQtyTotal('1');
    setNotes('');
    setFormError(null);
  };

  const onCreate = async () => {
    setFormError(null);
    if (!code.trim() || !name.trim()) {
      setFormError('Código y nombre son obligatorios.');
      return;
    }
    const total = Math.max(1, Number(qtyTotal) || 1);
    setSaving(true);
    try {
      await createEquipment({
        internalCode: code,
        name,
        brand: brand || null,
        model: model || null,
        categoryId: `cat-${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
        categoryName,
        status,
        trackMode: total > 1 ? 'bulk' : 'unit',
        qtyTotal: total,
        qtyAvailable: status === 'available' ? total : 0,
        notes: notes || null,
        labId: user?.labId ?? getLabId(),
        active: true,
      });
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el equipo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <View>
          <Text style={styles.hello}>Panel operativo</Text>
          <Text style={styles.title}>Inventario</Text>
        </View>
        <Avatar initials={getInitials(user?.displayName ?? 'EN')} size={28} />
      </View>

      <View style={styles.search}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por código, nombre o estado..."
          placeholderTextColor={theme.color.muted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.count}>{filtered.length} equipos</Text>
        <Pressable style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Text style={styles.addBtnText}>+ Alta</Text>
        </Pressable>
      </View>

      {error ? <Notice tone="danger" title="Error al cargar inventario" description={error} /> : null}

      {loading ? (
        <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 28 }}
          ListEmptyComponent={
            <Notice
              title="Inventario vacío"
              description="Ejecuta npm run seed:equipment o da de alta el primer equipo."
            />
          }
          renderItem={({ item }) => <MaterialCard equipment={item} showStatusBadge />}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Registrar equipo</Text>
            <ScrollView>
              {formError ? <Notice tone="danger" title={formError} /> : null}
              <TextField label="Código interno" value={code} onChangeText={setCode} placeholder="TOP-T06" />
              <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Teodolito T-06" />
              <TextField label="Marca" value={brand} onChangeText={setBrand} placeholder="Sokkia" />
              <TextField label="Modelo" value={model} onChangeText={setModel} placeholder="T-06" />
              <TextField
                label="Categoría"
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Topografía"
              />
              <TextField
                label="Cantidad total"
                value={qtyTotal}
                onChangeText={setQtyTotal}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>Estado</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setStatus(opt)}
                    style={[styles.chip, status === opt && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, status === opt && styles.chipTextActive]}>
                      {EQUIPMENT_STATUS_LABELS[opt]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextField
                label="Observaciones"
                value={notes}
                onChangeText={setNotes}
                placeholder="Opcional"
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                variant="secondary"
                fullWidth={false}
                style={{ flex: 1 }}
                onPress={() => {
                  setModalOpen(false);
                  resetForm();
                }}
              />
              <Button
                title="Guardar"
                loading={saving}
                fullWidth={false}
                style={{ flex: 1 }}
                onPress={onCreate}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvasMobile,
    paddingHorizontal: 16,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  hello: {
    color: theme.color.muted,
    fontSize: 11,
  },
  title: {
    color: theme.color.navy,
    fontSize: 20,
    fontWeight: '800',
  },
  search: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    backgroundColor: '#F3F5F7',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 6,
  },
  searchIcon: { color: theme.color.muted, fontSize: 14 },
  searchInput: { flex: 1, color: theme.color.ink, fontSize: 12, paddingVertical: 0 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  count: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  addBtn: {
    backgroundColor: theme.color.navy,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 18,
  },
  modalTitle: {
    color: theme.color.navy,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
    color: theme.color.navy,
    fontSize: 10,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: theme.color.navy,
    backgroundColor: theme.color.infoSoft,
  },
  chipText: {
    color: theme.color.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  chipTextActive: {
    color: theme.color.navy,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
