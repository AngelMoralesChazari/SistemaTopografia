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
  isAdminRole,
  type CategoryGroup,
  type Equipment,
  type EquipmentStatus,
} from '@lab-topo/domain';
import {
  createEquipment,
  updateEquipment,
  watchEquipment,
  writeAuditLog,
} from '@lab-topo/services';
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
    case 'damaged':
    case 'lost':
    case 'out_of_service':
      return 'late';
    default:
      return 'muted';
  }
}

type StatusFilter = 'all' | EquipmentStatus;

const ALL_STATUS_OPTIONS: { id: EquipmentStatus; label: string }[] = [
  { id: 'available', label: 'Disponible' },
  { id: 'maintenance', label: 'En mantenimiento' },
  { id: 'loaned', label: 'Prestado' },
  { id: 'reserved', label: 'Reservado' },
  { id: 'damaged', label: 'Dañado' },
  { id: 'out_of_service', label: 'Fuera de servicio' },
  { id: 'lost', label: 'Perdido' },
];

export function ManageEquipmentPage() {
  const { user } = useAuth();
  const canWrite = user ? isAdminRole(user.role) : false;

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

  // Formulario Alta de equipo
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('Topografía');
  const [newQtyTotal, setNewQtyTotal] = useState('1');
  const [newNotes, setNewNotes] = useState('');

  // Modal Edición de equipo
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editQtyTotal, setEditQtyTotal] = useState('');
  const [editQtyAvailable, setEditQtyAvailable] = useState('');
  const [editStatus, setEditStatus] = useState<EquipmentStatus>('available');
  const [editNotes, setEditNotes] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const kpis = useMemo(() => {
    const totalUnits = items.reduce((acc, curr) => acc + (curr.qtyTotal || 1), 0);
    const availableUnits = items.reduce((acc, curr) => acc + (curr.qtyAvailable || 0), 0);
    const available = items.filter((e) => e.status === 'available' && e.active !== false).length;
    const loaned = items.filter((e) => e.status === 'loaned').length;
    const maintenance = items.filter((e) => e.status === 'maintenance').length;
    return {
      total: items.length,
      totalUnits,
      availableUnits,
      available,
      loaned,
      maintenance,
    };
  }, [items]);

  // Lista de nombres de categorías existentes para sugerencias rápidas
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.categoryName?.trim()) set.add(it.categoryName.trim());
    }
    return Array.from(set);
  }, [items]);

  const groups = useMemo(
    (): CategoryGroup[] => buildCategoryGroups(items),
    [items]
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      if (g.name.toLowerCase().includes(q) || g.hint.toLowerCase().includes(q)) return true;
      return items.some(
        (e) =>
          categoryIdOf(e) === g.id &&
          `${e.name} ${e.internalCode} ${e.brand ?? ''} ${e.model ?? ''}`.toLowerCase().includes(q)
      );
    });
  }, [groups, search, items]);

  const selectedCategory = useMemo(
    () => groups.find((g) => g.id === selectedCategoryId) ?? null,
    [groups, selectedCategoryId]
  );

  const categoryItems = useMemo(() => {
    if (!selectedCategoryId) return [];
    const q = search.trim().toLowerCase();
    return items
      .filter((e) => categoryIdOf(e) === selectedCategoryId)
      .filter((e) => (statusFilter === 'all' ? true : e.status === statusFilter))
      .filter((e) =>
        q ? `${e.name} ${e.internalCode} ${e.brand ?? ''} ${e.model ?? ''}`.toLowerCase().includes(q) : true
      );
  }, [items, selectedCategoryId, statusFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, statusFilter, search]);

  const paging = useMemo(() => paginate(categoryItems, page), [categoryItems, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  // Apertura del modal de edición
  const openEditModal = (item: Equipment) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCode(item.internalCode);
    setEditBrand(item.brand ?? '');
    setEditModel(item.model ?? '');
    setEditCategoryName(item.categoryName);
    setEditQtyTotal(String(item.qtyTotal ?? 1));
    setEditQtyAvailable(String(item.qtyAvailable ?? 1));
    setEditStatus(item.status);
    setEditNotes(item.notes ?? '');
    setEditActive(item.active !== false);
    setEditError(null);
  };

  const closeEditModal = () => {
    if (editSaving) return;
    setEditingItem(null);
    setEditError(null);
  };

  // Guardar cambios del equipo editado
  const onSaveEdit = async () => {
    if (!canWrite || !editingItem) return;
    setEditError(null);

    const nameClean = editName.trim();
    const codeClean = editCode.trim();
    const categoryClean = editCategoryName.trim() || 'Topografía';
    const totalNum = Math.max(0, parseInt(editQtyTotal, 10) || 0);
    const availNum = Math.max(0, parseInt(editQtyAvailable, 10) || 0);

    if (!nameClean) {
      setEditError('El nombre del equipo no puede estar vacío.');
      return;
    }
    if (!codeClean) {
      setEditError('El código interno es obligatorio.');
      return;
    }
    if (totalNum < 0) {
      setEditError('La cantidad total no puede ser negativa.');
      return;
    }
    if (availNum > totalNum) {
      setEditError(`La cantidad disponible (${availNum}) no puede superar la total (${totalNum}).`);
      return;
    }

    setEditSaving(true);
    try {
      const catId = categoryIdOf({ categoryName: categoryClean, categoryId: '' } as Equipment);
      const patch = {
        name: nameClean,
        internalCode: codeClean,
        brand: editBrand.trim() || null,
        model: editModel.trim() || null,
        categoryName: categoryClean,
        categoryId: catId,
        qtyTotal: totalNum,
        qtyAvailable: availNum,
        status: editStatus,
        notes: editNotes.trim() || null,
        active: editActive,
      };

      await updateEquipment(editingItem.id, patch);

      // Registrar en auditoría
      if (user) {
        await writeAuditLog({
          labId: user.labId || getLabId(),
          actorId: user.uid,
          actorEmail: user.email,
          actorName: user.displayName,
          actorRole: user.role,
          action: 'EQUIPMENT_UPDATE',
          targetType: 'equipment',
          targetId: editingItem.id,
          summary: `Modificó equipo ${codeClean} (${nameClean}): Stock ${availNum}/${totalNum}, Estatus: ${EQUIPMENT_STATUS_LABELS[editStatus]}`,
          before: JSON.stringify({
            name: editingItem.name,
            code: editingItem.internalCode,
            qtyTotal: editingItem.qtyTotal,
            qtyAvailable: editingItem.qtyAvailable,
            status: editingItem.status,
            category: editingItem.categoryName,
          }),
          after: JSON.stringify({
            name: nameClean,
            code: codeClean,
            qtyTotal: totalNum,
            qtyAvailable: availNum,
            status: editStatus,
            category: categoryClean,
          }),
        });
      }

      showToast(`Equipo "${nameClean}" actualizado correctamente.`);
      setEditingItem(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setEditSaving(false);
    }
  };

  // Cambio rápido de estatus
  const onQuickStatusChange = async (item: Equipment, targetStatus: EquipmentStatus) => {
    if (!canWrite) return;
    try {
      const nextAvail = targetStatus === 'maintenance' || targetStatus === 'damaged' || targetStatus === 'lost'
        ? 0
        : targetStatus === 'available' && item.qtyAvailable === 0
          ? item.qtyTotal
          : item.qtyAvailable;

      await updateEquipment(item.id, {
        status: targetStatus,
        qtyAvailable: nextAvail,
      });

      if (user) {
        await writeAuditLog({
          labId: user.labId || getLabId(),
          actorId: user.uid,
          actorEmail: user.email,
          actorName: user.displayName,
          actorRole: user.role,
          action: 'EQUIPMENT_STATUS_CHANGE',
          targetType: 'equipment',
          targetId: item.id,
          summary: `Cambio rápido de estatus de ${item.internalCode}: ${EQUIPMENT_STATUS_LABELS[item.status]} → ${EQUIPMENT_STATUS_LABELS[targetStatus]}`,
        });
      }

      showToast(`Estatus de "${item.name}" actualizado a ${EQUIPMENT_STATUS_LABELS[targetStatus]}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al cambiar estatus.');
    }
  };

  // Alta de nuevo equipo
  const onCreate = async () => {
    if (!canWrite) return;
    setCreateError(null);
    if (!newCode.trim() || !newName.trim()) {
      setCreateError('Código y nombre son obligatorios.');
      return;
    }
    const total = Math.max(1, Number(newQtyTotal) || 1);
    setCreateSaving(true);
    try {
      const catClean = newCategoryName.trim() || 'Topografía';
      const newId = await createEquipment({
        internalCode: newCode.trim(),
        name: newName.trim(),
        brand: newBrand.trim() || null,
        model: newModel.trim() || null,
        categoryId: categoryIdOf({ categoryName: catClean, categoryId: '' } as Equipment),
        categoryName: catClean,
        status: 'available',
        trackMode: total > 1 ? 'bulk' : 'unit',
        qtyTotal: total,
        qtyAvailable: total,
        notes: newNotes.trim() || null,
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
          summary: `Alta de equipo ${newCode.trim()} (${newName.trim()}), cant: ${total}`,
        });
      }

      setShowCreateForm(false);
      setNewCode('');
      setNewName('');
      setNewBrand('');
      setNewModel('');
      setNewCategoryName('Topografía');
      setNewQtyTotal('1');
      setNewNotes('');
      showToast(`Equipo "${newName.trim()}" registrado con éxito.`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo registrar el equipo.');
    } finally {
      setCreateSaving(false);
    }
  };

  if (!canWrite) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <Notice
            tone="danger"
            title="Acceso restringido"
            description="Esta sección es exclusiva para administradores del laboratorio."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, isMobile && styles.contentMobile]} showsVerticalScrollIndicator={false}>
        {/* Encabezado */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Gestión de equipos</Text>
            <Text style={styles.subtitle}>
              Administración directa del catálogo: modifica nombres, stock, categorías y estatus.
            </Text>
          </View>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setCreateError(null);
              setShowCreateForm(true);
            }}
          >
            <MaterialIcons
              name="add"
              size={20}
              color="#fff"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.primaryBtnText}>Nuevo equipo</Text>
          </Pressable>
        </View>

        {/* Tarjetas de KPI */}
        <View style={styles.kpis}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Total equipos</Text>
            <Text style={styles.kpiValue}>{kpis.total}</Text>
            <Text style={styles.kpiSub}>{kpis.totalUnits} unidades en inventario</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Disponibles</Text>
            <Text style={[styles.kpiValue, { color: theme.color.success }]}>{kpis.available}</Text>
            <Text style={styles.kpiSub}>{kpis.availableUnits} unidades listas</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>En préstamo</Text>
            <Text style={[styles.kpiValue, { color: theme.color.delivered }]}>{kpis.loaned}</Text>
            <Text style={styles.kpiSub}>Con alumnos o terceros</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>En mantenimiento</Text>
            <Text style={[styles.kpiValue, { color: theme.color.warning }]}>{kpis.maintenance}</Text>
            <Text style={styles.kpiSub}>En revisión o reparación</Text>
          </View>
        </View>

        {/* Buscador */}
        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color={theme.color.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por código, nombre, categoría, marca o modelo..."
            placeholderTextColor={theme.color.muted}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={theme.color.muted} />
            </Pressable>
          ) : null}
        </View>

        {error ? <Notice tone="danger" title="Error al cargar inventario" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginVertical: 32 }} /> : null}

        {/* Grupos de material (cuando no hay grupo seleccionado) */}
        {!loading && !selectedCategoryId ? (
          <>
            <Text style={styles.sectionTitle}>Grupos de material</Text>
            <Text style={styles.sectionHint}>
              Elige un grupo de material para consultar y gestionar los equipos asociados.
            </Text>

            {filteredGroups.length === 0 ? (
              <Notice
                title="Sin grupos de material"
                description="No hay equipos registrados o no coinciden con la búsqueda. Puedes registrar uno con el botón '+ Nuevo equipo'."
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

        {/* Detalle del grupo seleccionado */}
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
                <Text style={styles.backText}>Grupos de material</Text>
              </Pressable>
              <View style={styles.groupTitleBlock}>
                <Text style={styles.groupTitle}>{selectedCategory?.name ?? 'Material'}</Text>
              </View>
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>{categoryItems.length} equipos</Text>
              </View>
            </View>

            <FilterChips
              label="Filtrar por estatus"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { id: 'all', label: 'Todos' },
                { id: 'available', label: 'Disponible' },
                { id: 'maintenance', label: 'En mantenimiento' },
                { id: 'loaned', label: 'En préstamo' },
                { id: 'reserved', label: 'Reservado' },
                { id: 'damaged', label: 'Dañado' },
                { id: 'out_of_service', label: 'Fuera de servicio' },
              ]}
            />

            <View style={[styles.card, isMobile && styles.cardMobile]}>
              {categoryItems.length === 0 ? (
                <Notice
                  title="Sin equipos en este filtro"
                  description="No se encontraron equipos bajo los criterios seleccionados."
                />
              ) : (
                <>
                  {!isMobile && (
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 2, minWidth: 160 }]}>Equipo / Código</Text>
                      <Text style={[styles.th, { flex: 1.2, minWidth: 120 }]}>Categoría / Marca</Text>
                      <Text style={[styles.th, { width: 90, textAlign: 'center' }]}>Stock</Text>
                      <Text style={[styles.th, { width: 130, textAlign: 'center' }]}>Estatus</Text>
                      <Text style={[styles.th, { width: 140, textAlign: 'right' }]}>Acciones</Text>
                    </View>
                  )}

                  {paging.pageItems.map((item) => {
                    const isMaint = item.status === 'maintenance';
                    const isAvail = item.status === 'available';

                    if (isMobile) {
                      return (
                        <View key={item.id} style={styles.mobileCard}>
                          {/* Fila superior: Código interno + Estatus */}
                          <View style={styles.mobileTopRow}>
                            <View style={styles.codeRow}>
                              <View style={styles.codeBadge}>
                                <Text style={styles.codeBadgeText}>{item.internalCode}</Text>
                              </View>
                              {item.active === false ? (
                                <View style={styles.inactiveBadge}>
                                  <Text style={styles.inactiveBadgeText}>Baja</Text>
                                </View>
                              ) : null}
                            </View>
                            <Badge
                              label={EQUIPMENT_STATUS_LABELS[item.status] ?? item.status}
                              tone={statusTone(item.status)}
                            />
                          </View>

                          {/* Nombre del equipo completo y legible */}
                          <Text style={styles.mobileName}>{item.name}</Text>

                          {/* Categoría y Marca/Modelo */}
                          <View style={styles.mobileMetaRow}>
                            <Text style={styles.mobileCategory}>{item.categoryName}</Text>
                            {item.brand || item.model ? (
                              <Text style={styles.mobileBrandModel}>
                                {item.brand ? ` · ${item.brand}` : ''}
                                {item.model ? ` · ${item.model}` : ''}
                              </Text>
                            ) : null}
                          </View>

                          {item.notes ? (
                            <Text style={styles.mobileNotes}>
                              Obs: {item.notes}
                            </Text>
                          ) : null}

                          {/* Fila inferior: Stock disponible y Botones de acción */}
                          <View style={styles.mobileBottomRow}>
                            <View style={styles.mobileStockWrap}>
                              <View style={styles.stockPill}>
                                <Text style={styles.stockAvail}>{item.qtyAvailable}</Text>
                                <Text style={styles.stockDivider}>/</Text>
                                <Text style={styles.stockTotal}>{item.qtyTotal}</Text>
                              </View>
                              <Text style={styles.stockLabel}>disp / total</Text>
                            </View>

                            <View style={styles.mobileActions}>
                              {/* Cambio rápido de estatus */}
                              {isAvail ? (
                                <Pressable
                                  style={styles.quickMaintBtn}
                                  onPress={() => onQuickStatusChange(item, 'maintenance')}
                                  accessibilityLabel="Poner en mantenimiento"
                                >
                                  <MaterialIcons name="build" size={15} color="#A76A00" />
                                </Pressable>
                              ) : null}

                              {isMaint ? (
                                <Pressable
                                  style={styles.quickAvailBtn}
                                  onPress={() => onQuickStatusChange(item, 'available')}
                                  accessibilityLabel="Reactivar a disponible"
                                >
                                  <MaterialIcons name="check" size={15} color="#16855B" />
                                </Pressable>
                              ) : null}

                              <Pressable
                                style={styles.editBtn}
                                onPress={() => openEditModal(item)}
                              >
                                <MaterialIcons name="edit" size={15} color={theme.color.navy} />
                                <Text style={styles.editBtnText}>Editar</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    }

                    return (
                      <View key={item.id} style={styles.row}>
                        {/* Información principal */}
                        <View style={{ flex: 2, minWidth: 160, paddingRight: 8 }}>
                          <View style={styles.codeRow}>
                            <View style={styles.codeBadge}>
                              <Text style={styles.codeBadgeText}>{item.internalCode}</Text>
                            </View>
                            {item.active === false ? (
                              <View style={styles.inactiveBadge}>
                                <Text style={styles.inactiveBadgeText}>Baja</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.rowName}>{item.name}</Text>
                          {item.notes ? (
                            <Text style={styles.rowNotes} numberOfLines={1}>
                              Obs: {item.notes}
                            </Text>
                          ) : null}
                        </View>

                        {/* Categoría y Marca */}
                        <View style={{ flex: 1.2, minWidth: 120, paddingRight: 8 }}>
                          <Text style={styles.rowCategory} numberOfLines={1}>
                            {item.categoryName}
                          </Text>
                          <Text style={styles.rowBrandModel} numberOfLines={1}>
                            {item.brand ? item.brand : ''}
                            {item.model ? ` · ${item.model}` : ''}
                            {!item.brand && !item.model ? '—' : ''}
                          </Text>
                        </View>

                        {/* Stock (disponible / total) */}
                        <View style={{ width: 90, alignItems: 'center' }}>
                          <View style={styles.stockPill}>
                            <Text style={styles.stockAvail}>{item.qtyAvailable}</Text>
                            <Text style={styles.stockDivider}>/</Text>
                            <Text style={styles.stockTotal}>{item.qtyTotal}</Text>
                          </View>
                          <Text style={styles.stockLabel}>disp / total</Text>
                        </View>

                        {/* Estatus */}
                        <View style={{ width: 130, alignItems: 'center' }}>
                          <Badge
                            label={EQUIPMENT_STATUS_LABELS[item.status] ?? item.status}
                            tone={statusTone(item.status)}
                          />
                        </View>

                        {/* Botones de acción */}
                        <View style={styles.rowActions}>
                          <Pressable
                            style={styles.editBtn}
                            onPress={() => openEditModal(item)}
                          >
                            <MaterialIcons name="edit" size={15} color={theme.color.navy} />
                            <Text style={styles.editBtnText}>Editar</Text>
                          </Pressable>

                          {/* Cambio rápido de estatus */}
                          {isAvail ? (
                            <Pressable
                              style={styles.quickMaintBtn}
                              onPress={() => onQuickStatusChange(item, 'maintenance')}
                              accessibilityLabel="Poner en mantenimiento"
                            >
                              <MaterialIcons name="build" size={14} color="#A76A00" />
                            </Pressable>
                          ) : null}

                          {isMaint ? (
                            <Pressable
                              style={styles.quickAvailBtn}
                              onPress={() => onQuickStatusChange(item, 'available')}
                              accessibilityLabel="Reactivar a disponible"
                            >
                              <MaterialIcons name="check" size={14} color="#16855B" />
                            </Pressable>
                          ) : null}
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
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Modal para Editar Equipo */}
      <Modal
        visible={Boolean(editingItem)}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.modalTitle}>Editar equipo</Text>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{editCode || 'SIN CÓDIGO'}</Text>
                  </View>
                </View>
                <Text style={styles.modalSub}>
                  Los cambios se sincronizarán inmediatamente a todos los usuarios.
                </Text>
              </View>
              <Pressable
                onPress={closeEditModal}
                style={styles.modalCloseBtn}
                disabled={editSaving}
              >
                <MaterialIcons name="close" size={22} color={theme.color.muted} />
              </Pressable>
            </View>

            {editError ? <Notice tone="danger" title={editError} /> : null}

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Nombre y Código */}
              <View style={styles.modalRow}>
                <TextField
                  label="Nombre del equipo *"
                  value={editName}
                  onChangeText={setEditName}
                  containerStyle={{ flex: 2 }}
                />
                <TextField
                  label="Código interno *"
                  value={editCode}
                  onChangeText={setEditCode}
                  containerStyle={{ flex: 1 }}
                />
              </View>

              {/* Categoría con sugerencias */}
              <View style={{ marginBottom: 12 }}>
                <TextField
                  label="Categoría *"
                  value={editCategoryName}
                  onChangeText={setEditCategoryName}
                  placeholder="Ej. Estación Total, GNSS / GPS, Niveles"
                />
                <View style={styles.suggestionsWrap}>
                  <Text style={styles.suggestionsLabel}>Sugerencias de categorías:</Text>
                  <View style={styles.suggestionsRow}>
                    {existingCategories.slice(0, 8).map((cat) => (
                      <Pressable
                        key={cat}
                        style={[
                          styles.suggPill,
                          editCategoryName.toLowerCase() === cat.toLowerCase() && styles.suggPillActive,
                        ]}
                        onPress={() => setEditCategoryName(cat)}
                      >
                        <Text
                          style={[
                            styles.suggPillText,
                            editCategoryName.toLowerCase() === cat.toLowerCase() && styles.suggPillTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* Marca y Modelo */}
              <View style={styles.modalRow}>
                <TextField
                  label="Marca"
                  value={editBrand}
                  onChangeText={setEditBrand}
                  containerStyle={{ flex: 1 }}
                  placeholder="Ej. Leica, Sokkia, Trimble"
                />
                <TextField
                  label="Modelo"
                  value={editModel}
                  onChangeText={setEditModel}
                  containerStyle={{ flex: 1 }}
                  placeholder="Ej. TS06 Plus, Set 530RK"
                />
              </View>

              {/* Cantidades Total y Disponible */}
              <View style={styles.modalRow}>
                <TextField
                  label="Cantidad total en inventario *"
                  value={editQtyTotal}
                  onChangeText={setEditQtyTotal}
                  keyboardType="number-pad"
                  containerStyle={{ flex: 1 }}
                />
                <TextField
                  label="Cantidad disponible para préstamo *"
                  value={editQtyAvailable}
                  onChangeText={setEditQtyAvailable}
                  keyboardType="number-pad"
                  containerStyle={{ flex: 1 }}
                />
              </View>

              {/* Selector de Estatus */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>Estatus del equipo *</Text>
                <View style={styles.statusChipsWrap}>
                  {ALL_STATUS_OPTIONS.map((opt) => {
                    const active = editStatus === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[styles.statusChip, active && styles.statusChipActive]}
                        onPress={() => setEditStatus(opt.id)}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor:
                                opt.id === 'available'
                                  ? theme.color.success
                                  : opt.id === 'maintenance'
                                    ? theme.color.warning
                                    : opt.id === 'loaned'
                                      ? theme.color.delivered
                                      : opt.id === 'damaged' || opt.id === 'lost'
                                        ? theme.color.red
                                        : theme.color.muted,
                            },
                          ]}
                        />
                        <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Observaciones */}
              <TextField
                label="Observaciones y estado físico"
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Condición general, número de serie, detalles de calibración..."
              />

              {/* Activo en catálogo */}
              <Pressable
                onPress={() => setEditActive((v) => !v)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: editActive }}
              >
                <MaterialIcons
                  name={editActive ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={editActive ? theme.color.navy : theme.color.muted}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.checkboxTitle}>Equipo activo en catálogo</Text>
                  <Text style={styles.checkboxDesc}>
                    Desmárcalo si este equipo ha sido dado de baja o retirado temporalmente.
                  </Text>
                </View>
              </Pressable>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Button
                title="Guardar cambios"
                loading={editSaving}
                onPress={onSaveEdit}
                style={styles.modalSaveBtn}
              />
              <Button
                title="Cancelar"
                variant="secondary"
                disabled={editSaving}
                onPress={closeEditModal}
                fullWidth={false}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Alta de nuevo equipo */}
      <Modal
        visible={showCreateForm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!createSaving) setShowCreateForm(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Nuevo equipo</Text>
                <Text style={styles.modalSub}>
                  Registra un nuevo elemento en el inventario del laboratorio.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!createSaving) setShowCreateForm(false);
                }}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color={theme.color.muted} />
              </Pressable>
            </View>

            {createError ? <Notice tone="danger" title={createError} /> : null}

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                <TextField
                  label="Código interno *"
                  value={newCode}
                  onChangeText={setNewCode}
                  placeholder="Ej: EST-03, NIV-01..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Nombre del equipo *"
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Ej: Estación Total Leica..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Marca"
                  value={newBrand}
                  onChangeText={setNewBrand}
                  placeholder="Ej: Leica, Topcon, Trimble..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Modelo"
                  value={newModel}
                  onChangeText={setNewModel}
                  placeholder="Ej: TS06 Plus..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Categoría"
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="Ej: Topografía, Drones, GPS..."
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Cantidad total"
                  value={newQtyTotal}
                  onChangeText={setNewQtyTotal}
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
                          newCategoryName.toLowerCase() === cat.toLowerCase() && styles.suggPillActive,
                        ]}
                        onPress={() => setNewCategoryName(cat)}
                      >
                        <Text
                          style={[
                            styles.suggPillText,
                            newCategoryName.toLowerCase() === cat.toLowerCase() && styles.suggPillTextActive,
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
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="Condición general, número de serie, detalles de calibración..."
              />
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Button
                title="Registrar equipo"
                loading={createSaving}
                onPress={onCreate}
                style={styles.modalSaveBtn}
              />
              <Button
                title="Cancelar"
                variant="secondary"
                disabled={createSaving}
                onPress={() => setShowCreateForm(false)}
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
  content: { padding: 28, paddingBottom: 64 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 6,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    lineHeight: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.navy,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },

  kpis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
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
  kpiLabel: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    fontWeight: '600',
  },
  kpiValue: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    marginTop: 6,
  },
  kpiSub: {
    color: theme.color.muted,
    fontSize: 12,
    marginTop: 4,
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
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
  },

  sectionTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionHint: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    marginBottom: 14,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  groupCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
    ...theme.shadow.soft,
  },
  groupCardPressed: {
    opacity: 0.9,
    borderColor: '#C5D8F0',
  },
  groupMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  groupMarkText: {
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: theme.font.size.md,
  },
  groupName: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  groupHint: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    minHeight: 36,
  },
  groupFoot: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupAvail: {
    color: theme.color.success,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
  },
  groupCount: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },

  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
  },
  backText: {
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: 13,
  },
  groupTitleBlock: {
    flex: 1,
    minWidth: 160,
  },
  groupEyebrow: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  groupTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.xl,
    fontWeight: '800',
  },
  groupBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.color.infoSoft,
  },
  groupBadgeText: {
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: 12,
  },

  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 18,
    marginBottom: 18,
    ...theme.shadow.soft,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '700',
  },
  cardSub: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    marginTop: 2,
  },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  th: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F6',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  codeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EBF1F7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  codeBadgeText: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  inactiveBadge: {
    backgroundColor: '#FDE8E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  inactiveBadgeText: {
    color: theme.color.red,
    fontSize: 11,
    fontWeight: '700',
  },
  rowName: {
    color: theme.color.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  rowNotes: {
    color: theme.color.muted,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  rowCategory: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  rowBrandModel: {
    color: theme.color.muted,
    fontSize: 12,
    marginTop: 2,
  },

  // Estilos responsivos para móvil
  cardMobile: {
    padding: 12,
  },
  contentMobile: {
    padding: 14,
    paddingBottom: 64,
  },
  mobileCard: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F6',
    gap: 6,
  },
  mobileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
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
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  mobileCategory: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  mobileBrandModel: {
    color: theme.color.muted,
    fontSize: 12,
  },
  mobileNotes: {
    color: theme.color.muted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  mobileBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    marginTop: 4,
  },
  mobileStockWrap: {
    alignItems: 'flex-start',
  },
  mobileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F6F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockAvail: {
    color: theme.color.success,
    fontSize: 14,
    fontWeight: '800',
  },
  stockDivider: {
    color: theme.color.muted,
    fontSize: 12,
    marginHorizontal: 3,
  },
  stockTotal: {
    color: theme.color.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  stockLabel: {
    color: theme.color.muted,
    fontSize: 10,
    marginTop: 2,
  },

  rowActions: {
    width: 140,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF4FB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D4E2F2',
  },
  editBtnText: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  quickMaintBtn: {
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#FFE099',
    padding: 6,
    borderRadius: 7,
  },
  quickAvailBtn: {
    backgroundColor: '#EAF8F1',
    borderWidth: 1,
    borderColor: '#B8EAD1',
    padding: 6,
    borderRadius: 7,
  },

  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  formField: {
    flexGrow: 1,
    flexBasis: 220,
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
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },

  fieldLabel: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  statusChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipActive: {
    borderColor: theme.color.navy,
    backgroundColor: '#EEF4FB',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: theme.color.navy,
    fontWeight: '800',
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.color.line,
    marginTop: 8,
    marginBottom: 16,
  },
  checkboxTitle: {
    color: theme.color.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  checkboxDesc: {
    color: theme.color.muted,
    fontSize: 11,
    marginTop: 2,
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
