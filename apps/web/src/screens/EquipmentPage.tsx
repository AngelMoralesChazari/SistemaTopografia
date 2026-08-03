import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme, getLabId } from '@lab-topo/config';
import {
  EQUIPMENT_STATUS_LABELS,
  buildCategoryGroups,
  categoryIdOf,
  type CategoryGroup,
  type Equipment,
  type EquipmentStatus,
} from '@lab-topo/domain';
import { createEquipment, watchEquipment } from '@lab-topo/services';
import { Badge, Button, Notice, TextField, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { FilterChips } from '../components/FilterChips';
import { StackedBar } from '../components/BarChart';
import { ListPagination } from '../components/ListPagination';
import { paginate } from '../lib/pagination';

function statusTone(status: EquipmentStatus): BadgeTone {
  switch (status) {
    case 'available':
      return 'ok';
    case 'reserved':
      return 'pending';
    case 'loaned':
      return 'delivered';
    case 'maintenance':
      return 'muted';
    default:
      return 'late';
  }
}

type StatusFilter = 'all' | EquipmentStatus;

export function EquipmentPage() {
  const { user } = useAuth();
  const canWrite =
    user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'lab_manager';
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [categoryName, setCategoryName] = useState('Topografía');
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

  const activeItems = useMemo(() => items.filter((e) => e.active !== false), [items]);

  const kpis = useMemo(() => {
    const available = activeItems.filter((e) => e.status === 'available').length;
    const loaned = activeItems.filter((e) => e.status === 'loaned').length;
    const maintenance = activeItems.filter((e) => e.status === 'maintenance').length;
    return { total: activeItems.length, available, loaned, maintenance };
  }, [activeItems]);

  const groups = useMemo(
    (): CategoryGroup[] => buildCategoryGroups(activeItems),
    [activeItems]
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      if (g.name.toLowerCase().includes(q) || g.hint.toLowerCase().includes(q)) return true;
      return activeItems.some(
        (e) =>
          categoryIdOf(e) === g.id &&
          `${e.name} ${e.internalCode}`.toLowerCase().includes(q)
      );
    });
  }, [groups, search, activeItems]);

  const selectedCategory = useMemo(
    () => groups.find((g) => g.id === selectedCategoryId) ?? null,
    [groups, selectedCategoryId]
  );

  const categoryItems = useMemo(() => {
    if (!selectedCategoryId) return [];
    const q = search.trim().toLowerCase();
    return activeItems
      .filter((e) => categoryIdOf(e) === selectedCategoryId)
      .filter((e) => (statusFilter === 'all' ? true : e.status === statusFilter))
      .filter((e) =>
        q ? `${e.name} ${e.internalCode} ${e.brand ?? ''}`.toLowerCase().includes(q) : true
      );
  }, [activeItems, selectedCategoryId, statusFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, statusFilter, search]);

  const paging = useMemo(() => paginate(categoryItems, page), [categoryItems, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  const onCreate = async () => {
    if (!canWrite) return;
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
        status: 'available',
        trackMode: total > 1 ? 'bulk' : 'unit',
        qtyTotal: total,
        qtyAvailable: total,
        notes: notes || null,
        labId: user?.labId ?? getLabId(),
        active: true,
      });
      setShowForm(false);
      setCode('');
      setName('');
      setBrand('');
      setModel('');
      setCategoryName('Topografía');
      setQtyTotal('1');
      setNotes('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Catálogo de equipos</Text>
          <Text style={styles.subtitle}>Inventario activo del laboratorio de topografía.</Text>
        </View>
        {canWrite ? (
          <Pressable style={styles.primaryBtn} onPress={() => setShowForm((v) => !v)}>
            <Text style={styles.primaryBtnText}>
              {showForm ? 'Cerrar formulario' : '+ Nuevo equipo'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Estado del inventario</Text>
        <StackedBar
          segments={[
            { id: 'available', label: 'Disponibles', value: kpis.available, color: '#16855B' },
            { id: 'loaned', label: 'En préstamo', value: kpis.loaned, color: '#7463BD' },
            { id: 'maintenance', label: 'Mantenimiento', value: kpis.maintenance, color: '#718092' },
            {
              id: 'other',
              label: 'Otros',
              value: Math.max(0, kpis.total - kpis.available - kpis.loaned - kpis.maintenance),
              color: '#19315F',
            },
          ]}
        />
      </View>

      <View style={styles.search}>
        <MaterialIcons name="search" size={20} color={theme.color.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar grupo o equipo…"
          placeholderTextColor={theme.color.muted}
          style={styles.searchInput}
        />
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alta de equipo</Text>
          {formError ? <Notice tone="danger" title={formError} /> : null}
          <View style={styles.formGrid}>
            <TextField label="Código interno" value={code} onChangeText={setCode} containerStyle={styles.formField} />
            <TextField label="Nombre" value={name} onChangeText={setName} containerStyle={styles.formField} />
            <TextField label="Marca" value={brand} onChangeText={setBrand} containerStyle={styles.formField} />
            <TextField label="Modelo" value={model} onChangeText={setModel} containerStyle={styles.formField} />
            <TextField
              label="Categoría"
              value={categoryName}
              onChangeText={setCategoryName}
              containerStyle={styles.formField}
            />
            <TextField
              label="Cantidad total"
              value={qtyTotal}
              onChangeText={setQtyTotal}
              keyboardType="number-pad"
              containerStyle={styles.formField}
            />
          </View>
          <TextField label="Observaciones" value={notes} onChangeText={setNotes} />
          <Button title="Guardar equipo" loading={saving} onPress={onCreate} />
        </View>
      ) : null}

      {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
      {loading ? <ActivityIndicator color={theme.color.navy} /> : null}

      {!loading && !selectedCategoryId ? (
        <>
          <Text style={styles.sectionTitle}>Grupos de material</Text>
          <Text style={styles.sectionHint}>Elige un grupo para ver y administrar los equipos.</Text>
          {filteredGroups.length === 0 ? (
            <Notice
              title="Sin grupos"
              description="Ejecuta npm run seed:equipment o registra el primer equipo."
            />
          ) : (
            <View style={styles.grid}>
              {filteredGroups.map((group) => (
                <Pressable
                  key={group.id}
                  style={styles.groupCard}
                  onPress={() => {
                    setSelectedCategoryId(group.id);
                    setStatusFilter('all');
                  }}
                >
                  <View style={styles.groupMark}>
                    <Text style={styles.groupMarkText}>{group.mark}</Text>
                  </View>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupHint}>{group.hint}</Text>
                  <View style={styles.groupFoot}>
                    <Text style={styles.groupCount}>{group.totalItems} ítems</Text>
                    <Text style={styles.groupAvail}>{group.availableCount} disp.</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : null}

      {!loading && selectedCategoryId ? (
        <>
          <View style={styles.groupHead}>
            <Pressable
              onPress={() => {
                setSelectedCategoryId(null);
                setStatusFilter('all');
              }}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-back" size={18} color={theme.color.navy} />
              <Text style={styles.backText}>Grupos</Text>
            </Pressable>
            <View style={styles.groupTitleBlock}>
              <Text style={styles.groupEyebrow}>Grupo</Text>
              <Text style={styles.groupTitle}>{selectedCategory?.name ?? 'Material'}</Text>
            </View>
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>{categoryItems.length} equipos</Text>
            </View>
          </View>

          <FilterChips
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: 'all', label: 'Todos' },
              { id: 'available', label: 'Disponible' },
              { id: 'loaned', label: 'En préstamo' },
              { id: 'maintenance', label: 'Mantenimiento' },
              { id: 'reserved', label: 'Reservado' },
            ]}
          />

          <View style={styles.card}>
            {categoryItems.length === 0 ? (
              <Notice title="Sin equipos" description="No hay material con esos filtros." />
            ) : (
              <>
                {paging.pageItems.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowCode}>{item.internalCode}</Text>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <Text style={styles.rowMeta}>
                        {item.brand ? `${item.brand}` : ''}
                        {item.model ? ` ${item.model}` : ''}
                        {!item.brand && !item.model ? item.categoryName : ''}
                      </Text>
                    </View>
                    <Text style={styles.rowQty}>
                      {item.qtyAvailable}/{item.qtyTotal}
                    </Text>
                    <Badge label={EQUIPMENT_STATUS_LABELS[item.status]} tone={statusTone(item.status)} />
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
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 28, paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 18,
  },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: { marginTop: 8, color: theme.color.muted, fontSize: theme.font.size.md },
  primaryBtn: {
    backgroundColor: theme.color.navy,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: theme.font.size.md, fontWeight: '800' },
  panel: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 14,
    ...theme.shadow.soft,
  },
  panelTitle: {
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: theme.font.size.md,
    marginBottom: 12,
  },
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: theme.color.ink, fontSize: theme.font.size.md },
  sectionTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionHint: { color: theme.color.muted, fontSize: theme.font.size.sm, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  groupCard: {
    flexGrow: 1,
    flexBasis: 200,
    minWidth: 180,
    maxWidth: 280,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    ...theme.shadow.soft,
  },
  groupMark: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  groupMarkText: { color: theme.color.navy, fontWeight: '900', fontSize: 13 },
  groupName: { color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.lg },
  groupHint: { marginTop: 4, color: theme.color.muted, fontSize: 12, lineHeight: 18 },
  groupFoot: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupCount: { color: theme.color.muted, fontWeight: '700', fontSize: 12 },
  groupAvail: { color: theme.color.success, fontWeight: '800', fontSize: 12 },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
  },
  backText: { color: theme.color.navy, fontWeight: '800', fontSize: 13 },
  groupTitleBlock: { flex: 1, minWidth: 160 },
  groupEyebrow: { color: theme.color.muted, fontSize: theme.font.size.sm },
  groupTitle: { color: theme.color.navy, fontSize: theme.font.size.xl, fontWeight: '800' },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.color.infoSoft,
  },
  groupBadgeText: { color: theme.color.navy, fontWeight: '800', fontSize: 12 },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 18,
    ...theme.shadow.soft,
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '700',
    marginBottom: 10,
  },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  formField: { flexGrow: 1, flexBasis: 220 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowCode: { color: theme.color.muted, fontSize: theme.font.size.sm, fontWeight: '700' },
  rowName: { color: theme.color.ink, fontSize: theme.font.size.lg, fontWeight: '700', marginTop: 2 },
  rowMeta: { color: theme.color.muted, fontSize: theme.font.size.md, marginTop: 2 },
  rowQty: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
    minWidth: 48,
    textAlign: 'right',
  },
});
