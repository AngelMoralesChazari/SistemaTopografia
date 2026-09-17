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
  useWindowDimensions,
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
import { createEquipment, watchEquipment, writeAuditLog } from '@lab-topo/services';
import { Badge, Button, Notice, TextField, Toast, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { FilterChips } from '../components/FilterChips';
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
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const isMobile = width < 860;
  const [containerWidth, setContainerWidth] = useState(0);
  const availableWidth =
    containerWidth > 0
      ? containerWidth
      : Math.max(300, width - (compact ? 0 : 280) - 80);
  const numColumns = !compact ? 4 : availableWidth > 560 ? 3 : availableWidth > 360 ? 2 : 1;
  const gridGap = 14;
  const cardWidth = Math.floor((availableWidth - gridGap * (numColumns - 1) - 4) / numColumns);
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

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

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

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.categoryName?.trim()) set.add(it.categoryName.trim());
    }
    return Array.from(set);
  }, [items]);

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
      const catClean = categoryName.trim() || 'Topografía';
      const newId = await createEquipment({
        internalCode: code.trim(),
        name: name.trim(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        categoryId: categoryIdOf({ categoryName: catClean, categoryId: '' } as Equipment),
        categoryName: catClean,
        status: 'available',
        trackMode: total > 1 ? 'bulk' : 'unit',
        qtyTotal: total,
        qtyAvailable: total,
        notes: notes.trim() || null,
        labId: user?.labId ?? getLabId(),
        active: true,
      });

      if (user) {
        await writeAuditLog({
          labId: user.labId || getLabId(),
          actorId: user.uid,
          actorEmail: user.email,
          actorName: user.displayName,
          actorRole: user.role,
          action: 'EQUIPMENT_CREATE',
          targetType: 'equipment',
          targetId: newId,
          summary: `Alta de equipo ${code.trim()} (${name.trim()}), cant: ${total}`,
        });
      }

      setShowForm(false);
      setCode('');
      setName('');
      setBrand('');
      setModel('');
      setCategoryName('Topografía');
      setQtyTotal('1');
      setNotes('');
      showToast(`Equipo "${name.trim()}" registrado con éxito.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, isMobile && styles.contentMobile]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Catálogo de equipos</Text>
            <Text style={styles.subtitle}>Inventario activo del laboratorio de topografía.</Text>
          </View>
          {canWrite ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                setFormError(null);
                setShowForm(true);
              }}
            >
              <MaterialIcons name="add" size={20} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.primaryBtnText}>Nuevo equipo</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.kpis}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Total equipos</Text>
            <Text style={styles.kpiValue}>{kpis.total}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Disponibles</Text>
            <Text style={styles.kpiValue}>{kpis.available}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>En préstamo</Text>
            <Text style={styles.kpiValue}>{kpis.loaned}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Mantenimiento</Text>
            <Text style={styles.kpiValue}>{kpis.maintenance}</Text>
          </View>
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
              <View
                style={styles.grid}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0 && Math.abs(w - containerWidth) > 1) {
                    setContainerWidth(w);
                  }
                }}
              >
                {filteredGroups.map((group) => (
                  <Pressable
                    key={group.id}
                    style={({ pressed }) => [
                      styles.groupCard,
                      { width: cardWidth },
                      pressed && styles.groupCardPressed,
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(group.id);
                      setStatusFilter('all');
                    }}
                  >
                    <View style={styles.groupMark}>
                      <Text style={styles.groupMarkText}>{group.mark}</Text>
                    </View>
                    <Text style={styles.groupName} numberOfLines={2}>
                      {group.name}
                    </Text>
                    <Text style={styles.groupHint} numberOfLines={2}>
                      {group.hint}
                    </Text>
                    <View style={styles.groupFoot}>
                      <Text style={styles.groupAvail}>{group.availableCount} disp.</Text>
                      <Text style={styles.groupCount}>
                        {group.totalItems} ítem{group.totalItems === 1 ? '' : 's'}
                      </Text>
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

            <View style={[styles.card, isMobile && styles.cardMobile]}>
              {categoryItems.length === 0 ? (
                <Notice title="Sin equipos" description="No hay material con esos filtros." />
              ) : (
                <>
                  {paging.pageItems.map((item) => {
                    if (isMobile) {
                      return (
                        <View key={item.id} style={styles.mobileCard}>
                          <View style={styles.mobileTopRow}>
                            <View style={styles.codeBadge}>
                              <Text style={styles.codeBadgeText}>{item.internalCode}</Text>
                            </View>
                            <Badge label={EQUIPMENT_STATUS_LABELS[item.status]} tone={statusTone(item.status)} />
                          </View>
                          <Text style={styles.mobileName}>{item.name}</Text>
                          <View style={styles.mobileMetaRow}>
                            <Text style={styles.mobileMeta}>
                              {item.brand ? `${item.brand}` : ''}
                              {item.model ? ` · ${item.model}` : ''}
                              {!item.brand && !item.model ? item.categoryName : ''}
                            </Text>
                            <Text style={styles.mobileQty}>
                              Stock: {item.qtyAvailable}/{item.qtyTotal}
                            </Text>
                          </View>
                        </View>
                      );
                    }

                    return (
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
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Modal Alta de nuevo equipo */}
      <Modal
        visible={showForm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setShowForm(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Nuevo equipo</Text>
                <Text style={styles.modalSub}>
                  Registra un nuevo elemento en el catálogo del laboratorio.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!saving) setShowForm(false);
                }}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color={theme.color.muted} />
              </Pressable>
            </View>

            {formError ? <Notice tone="danger" title={formError} /> : null}

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                <TextField
                  label="Código interno *"
                  value={code}
                  onChangeText={setCode}
                  placeholder="Ej: EST-03, NIV-01..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Nombre del equipo *"
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej: Estación Total Leica..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Marca"
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="Ej: Leica, Topcon, Trimble..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Modelo"
                  value={model}
                  onChangeText={setModel}
                  placeholder="Ej: TS06 Plus..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Categoría"
                  value={categoryName}
                  onChangeText={setCategoryName}
                  placeholder="Ej: Topografía, Drones, GPS..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Cantidad total"
                  value={qtyTotal}
                  onChangeText={setQtyTotal}
                  keyboardType="number-pad"
                  placeholder="1"
                  containerStyle={styles.formField}
                />
              </View>

              {/* Sugerencias rápidas de categorías */}
              {existingCategories.length > 0 ? (
                <View style={styles.suggestionsWrap}>
                  <Text style={styles.suggestionsLabel}>Sugerencias de categoría:</Text>
                  <View style={styles.suggestionsRow}>
                    {existingCategories.map((cat) => (
                      <Pressable
                        key={cat}
                        style={[
                          styles.suggPill,
                          categoryName.toLowerCase() === cat.toLowerCase() && styles.suggPillActive,
                        ]}
                        onPress={() => setCategoryName(cat)}
                      >
                        <Text
                          style={[
                            styles.suggPillText,
                            categoryName.toLowerCase() === cat.toLowerCase() && styles.suggPillTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <TextField
                label="Observaciones y estado físico"
                value={notes}
                onChangeText={setNotes}
                placeholder="Condición general, número de serie, detalles de calibración..."
              />
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Button
                title="Registrar equipo"
                loading={saving}
                onPress={onCreate}
                style={styles.modalSaveBtn}
              />
              <Button
                title="Cancelar"
                variant="secondary"
                disabled={saving}
                onPress={() => setShowForm(false)}
                fullWidth={false}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Toast message={toast ?? ''} visible={toastVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 28, paddingBottom: 48 },
  contentMobile: { padding: 14, paddingBottom: 48 },
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.navy,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: theme.font.size.md, fontWeight: '800' },
  kpis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  kpi: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 100,
    padding: 16,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    ...theme.shadow.soft,
  },
  kpiLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  kpiValue: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    marginTop: 8,
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
  searchInput: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    outlineStyle: 'none' as unknown as undefined,
    outlineWidth: 0,
  },
  sectionTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionHint: { color: theme.color.muted, fontSize: theme.font.size.sm, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  groupCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
    ...theme.shadow.soft,
  },
  groupCardPressed: { opacity: 0.9, borderColor: '#C5D8F0' },
  groupMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  groupMarkText: { color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.md },
  groupName: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  groupHint: { color: theme.color.muted, fontSize: theme.font.size.sm, minHeight: 36 },
  groupFoot: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupAvail: { color: theme.color.success, fontSize: theme.font.size.sm, fontWeight: '800' },
  groupCount: { color: theme.color.muted, fontSize: theme.font.size.sm },
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
  cardMobile: {
    padding: 12,
  },
  mobileCard: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
    gap: 6,
  },
  mobileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  codeBadge: {
    backgroundColor: '#EBF1F7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  codeBadgeText: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  mobileName: {
    color: theme.color.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 2,
  },
  mobileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  mobileMeta: {
    color: theme.color.muted,
    fontSize: 12,
  },
  mobileQty: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '700',
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

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    ...theme.shadow.soft,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.xl,
    fontWeight: '800',
  },
  modalSub: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F0F3F7',
  },
  modalBody: {
    maxHeight: 560,
  },
  suggestionsWrap: {
    marginTop: 4,
    marginBottom: 10,
  },
  suggestionsLabel: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F0F4F8',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggPillActive: {
    backgroundColor: theme.color.navy,
    borderColor: theme.color.navy,
  },
  suggPillText: {
    color: theme.color.ink,
    fontSize: 11,
    fontWeight: '600',
  },
  suggPillTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  modalSaveBtn: {
    flex: 1,
  },
});
