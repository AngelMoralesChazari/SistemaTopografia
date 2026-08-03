import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, getLabId } from '@lab-topo/config';
import {
  EQUIPMENT_STATUS_LABELS,
  buildCategoryGroups,
  categoryIdOf,
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

const KNOWN_CATEGORIES = [
  'Medición',
  'Niveles',
  'Ángulos y estación',
  'GNSS',
  'Soporte y accesorios',
  'Dibujo y gabinete',
];

export function InventoryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [categoryName, setCategoryName] = useState('Medición');
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
      },
      { onlyActive: true }
    );
    return unsub;
  }, []);

  const categories = useMemo(() => buildCategoryGroups(items), [items]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || selectedCategoryId) return categories;
    return categories.filter((c) => {
      const hay = `${c.name} ${c.hint}`.toLowerCase();
      return hay.includes(q);
    });
  }, [categories, search, selectedCategoryId]);

  const categoryItems = useMemo(() => {
    if (!selectedCategoryId) return [];
    const base = items.filter((e) => categoryIdOf(e) === selectedCategoryId);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => {
      const hay = `${e.name} ${e.internalCode} ${e.status} ${e.brand ?? ''} ${e.model ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, selectedCategoryId, search]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;

  const openCategory = (categoryId: string) => {
    setSearch('');
    setSelectedCategoryId(categoryId);
  };

  const backToGroups = () => {
    setSearch('');
    setSelectedCategoryId(null);
  };

  const resetForm = (prefCategory?: string) => {
    setCode('');
    setName('');
    setBrand('');
    setModel('');
    setCategoryName(prefCategory ?? selectedCategory?.name ?? 'Medición');
    setStatus('available');
    setQtyTotal('1');
    setNotes('');
    setFormError(null);
  };

  const openCreate = () => {
    resetForm(selectedCategory?.name);
    setModalOpen(true);
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
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
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
            placeholder={
              selectedCategoryId
                ? 'Buscar en este grupo...'
                : 'Buscar grupo: medición, GNSS...'
            }
            placeholderTextColor={theme.color.muted}
            style={styles.searchInput}
          />
        </View>

        {error ? (
          <Notice tone="danger" title="Error al cargar inventario" description={error} />
        ) : null}

        {loading ? (
          <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
        ) : !selectedCategoryId ? (
          <>
            <View style={styles.toolbar}>
              <Text style={styles.label}>Grupos de material</Text>
              <Pressable style={styles.addBtn} onPress={openCreate}>
                <Text style={styles.addBtnText}>+ Alta</Text>
              </Pressable>
            </View>
            <Text style={styles.helperTop}>
              Elige un grupo para ver el inventario de esa categoría.
            </Text>

            {filteredCategories.length === 0 ? (
              <Notice
                title="Inventario vacío"
                description="Ejecuta npm run seed:equipment o da de alta el primer equipo."
              />
            ) : (
              <View style={styles.grid}>
                {filteredCategories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => openCategory(cat.id)}
                    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                  >
                    <View style={styles.tileMark}>
                      <Text style={styles.tileMarkText}>{cat.mark}</Text>
                    </View>
                    <Text style={styles.tileName} numberOfLines={2}>
                      {cat.name}
                    </Text>
                    <Text style={styles.tileHint} numberOfLines={2}>
                      {cat.hint}
                    </Text>
                    <View style={styles.tileFooter}>
                      <Text style={styles.tileCount}>{cat.availableCount} disp.</Text>
                      <Text style={styles.tileItems}>
                        {cat.totalItems} ítem{cat.totalItems === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.groupHead}>
              <Pressable
                onPress={backToGroups}
                style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Volver a grupos"
              >
                <MaterialIcons name="arrow-back" size={18} color={theme.color.navy} />
              </Pressable>
              <View style={styles.groupTitleBlock}>
                <Text style={styles.groupEyebrow}>Grupo</Text>
                <Text style={styles.groupTitle} numberOfLines={1}>
                  {selectedCategory?.name ?? 'Material'}
                </Text>
              </View>
              <Pressable style={styles.addBtn} onPress={openCreate}>
                <Text style={styles.addBtnText}>+ Alta</Text>
              </Pressable>
            </View>

            <Text style={styles.groupMeta}>
              {categoryItems.length} equipo{categoryItems.length === 1 ? '' : 's'} en este grupo
            </Text>

            {categoryItems.length === 0 ? (
              <Notice
                title="Sin equipos en este grupo"
                description="Da de alta el primer equipo o limpia el buscador."
              />
            ) : (
              categoryItems.map((item) => (
                <MaterialCard key={item.id} equipment={item} showStatusBadge />
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Registrar equipo</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {formError ? <Notice tone="danger" title={formError} /> : null}
              <TextField
                label="Código interno"
                value={code}
                onChangeText={setCode}
                placeholder="MED-CM50"
              />
              <TextField
                label="Nombre"
                value={name}
                onChangeText={setName}
                placeholder="Cinta métrica 50 m"
              />
              <TextField label="Marca" value={brand} onChangeText={setBrand} placeholder="Lufkin" />
              <TextField label="Modelo" value={model} onChangeText={setModel} placeholder="CM-50" />

              <Text style={styles.fieldLabel}>Categoría / grupo</Text>
              <View style={styles.statusRow}>
                {KNOWN_CATEGORIES.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setCategoryName(opt)}
                    style={[styles.chip, categoryName === opt && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, categoryName === opt && styles.chipTextActive]}>
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextField
                label="Cantidad total"
                value={qtyTotal}
                onChangeText={setQtyTotal}
                keyboardType="number-pad"
              />
              <Text style={styles.fieldLabel}>Estado</Text>
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
    paddingHorizontal: 14,
  },
  scrollFlex: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 28,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 8,
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
    marginBottom: 15,
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  helperTop: {
    marginBottom: 12,
    color: theme.color.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  addBtn: {
    backgroundColor: theme.color.navy,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    minWidth: '45%',
    maxWidth: '48.5%',
    padding: 12,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    minHeight: 128,
  },
  tilePressed: {
    opacity: 0.88,
    borderColor: theme.color.navy,
    backgroundColor: '#F7FAFD',
  },
  tileMark: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.color.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileMarkText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tileName: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  tileHint: {
    color: theme.color.muted,
    fontSize: 10,
    lineHeight: 13,
    flexGrow: 1,
  },
  tileFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileCount: {
    color: theme.color.success,
    fontSize: 10,
    fontWeight: '800',
  },
  tileItems: {
    color: theme.color.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: theme.color.infoSoft,
    borderColor: '#C5D8F0',
  },
  groupTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  groupEyebrow: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 1,
  },
  groupTitle: {
    color: theme.color.navy,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  groupMeta: {
    marginBottom: 10,
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '600',
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
  fieldLabel: {
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
