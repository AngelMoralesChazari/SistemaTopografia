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
import { theme } from '@lab-topo/config';
import {
  buildCategoryGroups,
  categoryIdOf,
  getInitials,
  isTotalStation,
  RENTAL_TEACHER_ID,
  RENTAL_TEACHER_NAME,
  TOTAL_STATION_KIT_ITEMS,
  type CategoryGroup,
  type Equipment,
  type LoanExtraItem,
} from '@lab-topo/domain';
import { createLoanRequest, watchEquipment } from '@lab-topo/services';
import { Avatar, Button, MaterialCard, Notice, Toast } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { AppDatePicker } from '../components/AppDatePicker';
import { ListPagination } from '../components/ListPagination';
import { paginate } from '../lib/pagination';

const MS_24H = 24 * 60 * 60 * 1000;

function formatDateTime(date: Date): string {
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDisplayDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseDisplayDateWithTime(value: string, timeSource: Date): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  const d = new Date(
    year,
    month,
    day,
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  );
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

export function StudentCatalogPage() {
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const compact = width < 900;
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestAt, setRequestAt] = useState(() => new Date());
  const [defaultDueAt, setDefaultDueAt] = useState(() => new Date(Date.now() + MS_24H));
  const [extendTime, setExtendTime] = useState(false);
  const [customDueDisplay, setCustomDueDisplay] = useState('');
  const [showKitDetails, setShowKitDetails] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<LoanExtraItem[]>([]);
  const [extraPickerOpen, setExtraPickerOpen] = useState(false);
  const [extraSearch, setExtraSearch] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [successFolio, setSuccessFolio] = useState<string | null>(null);

  // Carrito / Lote de materiales acumulados antes de solicitar
  const [cartItems, setCartItems] = useState<
    Array<{
      id: string;
      equipment: Equipment;
      teacherId: string;
      teacherName: string;
      requestedAt: Date;
      dueAt: Date;
      extendTime: boolean;
      customDueDisplay: string;
      kitItems?: string[] | null;
      extraItems?: LoanExtraItem[] | null;
    }>
  >([]);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

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

  const kpis = useMemo(() => {
    const available = items.filter((e) => e.status === 'available').length;
    const loaned = items.filter((e) => e.status === 'loaned').length;
    const maintenance = items.filter((e) => e.status === 'maintenance').length;
    return { total: items.length, available, loaned, maintenance };
  }, [items]);

  const availableItems = useMemo(
    () => items.filter((e) => e.active !== false && (e.status === 'available' || e.qtyAvailable > 0)),
    [items]
  );

  const categories = useMemo(
    (): CategoryGroup[] => buildCategoryGroups(availableItems),
    [availableItems]
  );

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || selectedCategoryId) return categories;
    return categories.filter((c) => `${c.name} ${c.hint}`.toLowerCase().includes(q));
  }, [categories, search, selectedCategoryId]);

  const categoryItems = useMemo(() => {
    if (!selectedCategoryId) return [];
    const base = availableItems.filter((e) => categoryIdOf(e) === selectedCategoryId);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) =>
      `${e.name} ${e.internalCode} ${e.brand ?? ''} ${e.model ?? ''}`.toLowerCase().includes(q)
    );
  }, [availableItems, selectedCategoryId, search]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, search]);

  const paging = useMemo(() => paginate(categoryItems, page), [categoryItems, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const selectedEquipment = items.find((e) => e.id === selectedEquipmentId) ?? null;
  const categoryItemKey = categoryItems.map((e) => e.id).join('|');

  useEffect(() => {
    if (!selectedCategoryId) {
      setSelectedEquipmentId(null);
      return;
    }
    const ids = categoryItemKey ? categoryItemKey.split('|') : [];
    setSelectedEquipmentId((current) => {
      if (current && ids.includes(current)) return current;
      return ids[0] ?? null;
    });
  }, [selectedCategoryId, categoryItemKey]);

  const resolvedDueAt = useMemo(() => {
    if (!extendTime) return defaultDueAt;
    return parseDisplayDateWithTime(customDueDisplay, defaultDueAt);
  }, [extendTime, customDueDisplay, defaultDueAt]);

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
  };

  const openCategory = (categoryId: string) => {
    setSearch('');
    setSelectedCategoryId(categoryId);
  };

  const backToGroups = () => {
    setSearch('');
    setSelectedCategoryId(null);
    setSelectedEquipmentId(null);
  };

  const isSelectedStation = isTotalStation(selectedEquipment);

  const selectableExtras = useMemo(() => {
    const q = extraSearch.trim().toLowerCase();
    const alreadySelectedIds = new Set(selectedExtras.map((e) => e.equipmentId));
    return availableItems.filter((item) => {
      if (item.id === selectedEquipment?.id) return false;
      if (alreadySelectedIds.has(item.id)) return false;
      if (item.qtyAvailable <= 0) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.internalCode.toLowerCase().includes(q) ||
        (item.brand ?? '').toLowerCase().includes(q) ||
        (item.model ?? '').toLowerCase().includes(q)
      );
    });
  }, [availableItems, selectedEquipment?.id, selectedExtras, extraSearch]);

  const addExtra = (item: Equipment) => {
    setSelectedExtras((prev) => [
      ...prev,
      {
        equipmentId: item.id,
        name: item.name,
        internalCode: item.internalCode,
        quantity: 1,
      },
    ]);
    setExtraPickerOpen(false);
    setExtraSearch('');
  };

  const removeExtra = (equipmentId: string) => {
    setSelectedExtras((prev) => prev.filter((e) => e.equipmentId !== equipmentId));
  };

  const updateExtraQty = (equipmentId: string, delta: number) => {
    const targetItem = items.find((i) => i.id === equipmentId);
    const maxAvailable = targetItem?.qtyAvailable ?? 99;
    setSelectedExtras((prev) =>
      prev.map((e) => {
        if (e.equipmentId !== equipmentId) return e;
        const nextQty = Math.max(1, Math.min(maxAvailable, e.quantity + delta));
        return { ...e, quantity: nextQty };
      })
    );
  };

  const openConfirmFor = (targetEquipment?: Equipment | null) => {
    const equip = targetEquipment ?? selectedEquipment;
    if (!equip) {
      showToast('Selecciona un equipo de la lista antes de continuar.');
      return;
    }
    setSelectedEquipmentId(equip.id);
    const alreadyInCart = cartItems.some((c) => c.equipment.id === equip.id);
    if (alreadyInCart) {
      showToast(`"${equip.name}" ya está añadido en tu pedido.`);
      return;
    }
    const teacherReady =
      user?.role === 'teacher'
        ? Boolean(user.uid && user.displayName)
        : user?.role === 'renter'
          ? Boolean(user.uid && user.renterStatus === 'approved')
          : Boolean(user?.teacherId && user.teacherName);
    if (!teacherReady) {
      showToast(
        user?.role === 'teacher'
          ? 'No se pudo identificar tu perfil de maestro.'
          : user?.role === 'renter'
            ? 'Tu cuenta de renta aún no está aprobada.'
            : 'Tu perfil no tiene profesor asignado. Ejecuta npm run seed:users o contacta al administrador.'
      );
      return;
    }
    const now = new Date();
    const due = new Date(now.getTime() + MS_24H);
    setRequestAt(now);
    setDefaultDueAt(due);
    setExtendTime(false);
    setCustomDueDisplay(toDisplayDate(due));
    setSelectedExtras([]);
    setShowKitDetails(false);
    setConfirmOpen(true);
  };

  const openConfirm = () => openConfirmFor(null);

  const closeConfirm = () => {
    if (submitting) return;
    setConfirmOpen(false);
  };

  const onPickCustomDate = (date: Date) => {
    setCustomDueDisplay(toDisplayDate(date));
  };

  const resolveTeacher = () => {
    if (!user) return null;
    if (user.role === 'renter') {
      return { teacherId: RENTAL_TEACHER_ID, teacherName: RENTAL_TEACHER_NAME };
    }
    if (user.role === 'teacher') {
      return { teacherId: user.uid, teacherName: user.displayName };
    }
    if (!user.teacherId || !user.teacherName) return null;
    return { teacherId: user.teacherId, teacherName: user.teacherName };
  };

  const onAddToCart = () => {
    if (!user || !selectedEquipment) return;
    const teacher = resolveTeacher();
    if (!teacher) {
      showToast(
        user.role === 'teacher'
          ? 'No se pudo identificar tu perfil de maestro.'
          : user.role === 'renter'
            ? 'Tu cuenta de renta aún no está aprobada.'
            : 'Tu perfil no tiene profesor asignado.'
      );
      return;
    }
    if (!resolvedDueAt) {
      showToast('Fecha inválida. Elige una fecha válida.');
      return;
    }
    if (resolvedDueAt.getTime() <= Date.now()) {
      showToast('La fecha de devolución debe ser posterior a ahora.');
      return;
    }
    if (extendTime && resolvedDueAt.getTime() < defaultDueAt.getTime()) {
      showToast('Si solicitas más tiempo, la fecha debe ser posterior a las 24 h.');
      return;
    }

    const alreadyInCart = cartItems.some((c) => c.equipment.id === selectedEquipment.id);
    if (alreadyInCart) {
      showToast(`"${selectedEquipment.name}" ya está añadido en tu pedido.`);
      setConfirmOpen(false);
      return;
    }

    const newItem = {
      id: `${selectedEquipment.id}-${Date.now()}`,
      equipment: selectedEquipment,
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      requestedAt: requestAt,
      dueAt: resolvedDueAt,
      extendTime,
      customDueDisplay,
      kitItems: isSelectedStation ? [...TOTAL_STATION_KIT_ITEMS] : null,
      extraItems: selectedExtras.length > 0 ? [...selectedExtras] : null,
    };

    setCartItems((prev) => [...prev, newItem]);
    setConfirmOpen(false);
    setSelectedExtras([]);
    setExtendTime(false);
    showToast(`✓ "${selectedEquipment.name}" añadido al pedido (${cartItems.length + 1} en total)`);
  };

  const removeCartItem = (itemId: string) => {
    setCartItems((prev) => {
      const next = prev.filter((item) => item.id !== itemId);
      if (next.length === 0) {
        setCartModalOpen(false);
      }
      return next;
    });
    showToast('Material removido del pedido.');
  };

  const onSubmitCartOrder = async () => {
    if (!user || cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const created = await Promise.all(
        cartItems.map((c) =>
          createLoanRequest({
            labId: user.labId,
            equipmentId: c.equipment.id,
            equipmentName: c.equipment.name,
            equipmentCode: c.equipment.internalCode,
            studentId: user.uid,
            studentName: user.displayName,
            studentNumber: user.studentId ?? user.employeeId ?? user.rfc ?? null,
            teacherId: c.teacherId,
            teacherName: c.teacherName,
            dueAt: c.dueAt.toISOString(),
            loanType: user.role === 'renter' ? 'rental' : 'academic',
            kitItems: c.kitItems ?? null,
            extraItems: c.extraItems ?? null,
          })
        )
      );

      setCreatedCount(created.length);
      setSuccessFolio(created.map((l) => `#${l.folio}`).join(', '));
      setCartItems([]);
      setCartModalOpen(false);
      setSuccessOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar el pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={styles.title}>Catálogo de equipos</Text>
            <Text style={styles.subtitle}>Inventario activo del laboratorio de topografía.</Text>
          </View>
          <View style={styles.headerRight}>
            {cartItems.length > 0 ? (
              <Pressable
                onPress={() => setCartModalOpen(true)}
                style={({ pressed }) => [
                  styles.headerOrderBtn,
                  pressed && { opacity: 0.9 },
                ]}
                accessibilityRole="button"
              >
                <MaterialIcons name="shopping-bag" size={18} color="#fff" />
                <Text style={styles.headerOrderBtnText}>
                  Solicitar material ({cartItems.length})
                </Text>
              </Pressable>
            ) : null}
            <Avatar initials={getInitials(user?.displayName ?? 'AL')} size={40} />
          </View>
        </View>

        <View style={styles.kpis}>
          {[
            { label: 'Total equipos', value: String(kpis.total) },
            { label: 'Disponibles', value: String(kpis.available) },
            { label: 'En préstamo', value: String(kpis.loaned) },
            { label: 'Mantenimiento', value: String(kpis.maintenance) },
          ].map((kpi) => (
            <View key={kpi.label} style={styles.kpi}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color={theme.color.muted} />
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
          <Notice tone="danger" title="No se pudo cargar el catálogo" description={error} />
        ) : null}
        {loading ? <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} /> : null}

        {!loading && !selectedCategoryId ? (
          <>
            <Text style={styles.sectionTitle}>Grupos de material</Text>
            <Text style={styles.sectionHint}>
              {user?.role === 'teacher'
                ? 'Elige un grupo y solicita material para ti.'
                : user?.role === 'renter'
                  ? 'Elige un grupo y solicita renta de equipo.'
                  : 'Elige un grupo para ver el equipo y solicitar un préstamo.'}
            </Text>
            {filteredCategories.length === 0 ? (
              <Notice
                title="Sin grupos"
                description="No hay material disponible. Ejecuta npm run seed:equipment si el inventario está vacío."
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
                {filteredCategories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => openCategory(cat.id)}
                    style={({ pressed }) => [
                      styles.tile,
                      { width: cardWidth },
                      pressed && styles.tilePressed,
                    ]}
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
        ) : null}

        {!loading && selectedCategoryId ? (
          <>
            <View style={styles.groupHead}>
              <Pressable onPress={backToGroups} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={18} color={theme.color.navy} />
                <Text style={styles.backText}>Volver a grupos</Text>
              </Pressable>
              <View style={styles.groupTitleBlock}>
                <Text style={styles.groupEyebrow}>Grupo</Text>
                <Text style={styles.groupTitle}>{selectedCategory?.name ?? 'Material'}</Text>
              </View>
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>{categoryItems.length} disp.</Text>
              </View>
              {cartItems.length > 0 ? (
                <Pressable
                  onPress={() => setCartModalOpen(true)}
                  style={({ pressed }) => [
                    styles.groupOrderBtn,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                >
                  <MaterialIcons name="shopping-bag" size={16} color="#fff" />
                  <Text style={styles.groupOrderBtnText}>
                    Solicitar material ({cartItems.length})
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {categoryItems.length === 0 ? (
              <Notice
                title="Sin equipos en este grupo"
                description="Prueba otro grupo o limpia el buscador."
              />
            ) : (
              <View style={styles.list}>
                {paging.pageItems.map((item) => {
                  const inCart = cartItems.some((c) => c.equipment.id === item.id);
                  const isAvailable = item.qtyAvailable > 0 && item.status !== 'maintenance';

                  let rightAction: React.ReactNode = null;
                  if (inCart) {
                    rightAction = (
                      <Pressable
                        onPress={() => setCartModalOpen(true)}
                        style={styles.rowInCartBadge}
                        hitSlop={6}
                      >
                        <MaterialIcons name="check-circle" size={15} color={theme.color.success} />
                        <Text style={styles.rowInCartText}>En pedido</Text>
                      </Pressable>
                    );
                  } else if (isAvailable) {
                    rightAction = (
                      <Pressable
                        onPress={() => openConfirmFor(item)}
                        style={({ pressed }) => [
                          styles.rowAddBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                        hitSlop={6}
                      >
                        <MaterialIcons name="add" size={16} color="#fff" />
                        <Text style={styles.rowAddBtnText}>Añadir</Text>
                      </Pressable>
                    );
                  } else {
                    rightAction = (
                      <View style={styles.rowUnavailableBadge}>
                        <Text style={styles.rowUnavailableText}>Agotado</Text>
                      </View>
                    );
                  }

                  return (
                    <MaterialCard
                      key={item.id}
                      equipment={item}
                      selected={item.id === selectedEquipmentId}
                      onPress={() => {
                        if (inCart) {
                          setCartModalOpen(true);
                        } else if (isAvailable) {
                          openConfirmFor(item);
                        } else {
                          showToast('Este material no está disponible para préstamo.');
                        }
                      }}
                      rightAction={rightAction}
                    />
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
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Botón flotante para confirmar pedido de todos los materiales */}
      {cartItems.length > 0 ? (
        <View
          style={[
            styles.floatingPillContainer,
            compact && styles.floatingPillContainerCompact,
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => setCartModalOpen(true)}
            style={({ pressed }) => [
              styles.floatingCartPill,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
          >
            <View style={styles.floatingPillIconWrap}>
              <MaterialIcons name="shopping-bag" size={18} color="#fff" />
              <View style={styles.floatingPillBadge}>
                <Text style={styles.floatingPillBadgeText}>{cartItems.length}</Text>
              </View>
            </View>
            <Text style={styles.floatingPillTitle}>
              Solicitar material ({cartItems.length})
            </Text>
            <MaterialIcons name="arrow-forward" size={16} color="#93C5FD" />
          </Pressable>
        </View>
      ) : null}

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={closeConfirm}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: Math.min(740, height - 32) }]}>
            <ScrollView
              style={{ maxHeight: '100%' }}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Añadir material al pedido</Text>
              <Text style={styles.modalSubtitle}>
                Revisa el material y el plazo de devolución antes de añadirlo.
              </Text>

              <View style={styles.summaryBox}>
                {[
                  ['Material', selectedEquipment?.name ?? '—'],
                  ['Código', selectedEquipment?.internalCode ?? '—'],
                  [
                    user?.role === 'renter' ? 'Tipo' : 'Profesor',
                    user?.role === 'renter'
                      ? 'Renta particular'
                      : user?.role === 'teacher'
                        ? user.displayName
                        : (user?.teacherName ?? '—'),
                  ],
                  ['Fecha de solicitud', formatDateTime(requestAt)],
                  [
                    'Fecha de devolución',
                    resolvedDueAt ? formatDateTime(resolvedDueAt) : 'Fecha inválida',
                  ],
                ].map(([label, value], index, arr) => (
                  <View
                    key={label}
                    style={[styles.summaryRow, index === arr.length - 1 && styles.summaryRowLast]}
                  >
                    <Text style={styles.summaryLabel}>{label}</Text>
                    <Text style={styles.summaryValue}>{value}</Text>
                  </View>
                ))}
              </View>

              {isSelectedStation ? (
                <View style={styles.kitCard}>
                  <Pressable
                    onPress={() => setShowKitDetails((v) => !v)}
                    style={styles.kitHead}
                    accessibilityRole="button"
                  >
                    <View style={styles.kitHeadLeft}>
                      <View style={styles.kitIconWrap}>
                        <MaterialIcons name="inventory-2" size={18} color={theme.color.navy} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.kitTitle}>Kit de Estación Total</Text>
                        <Text style={styles.kitSubtitle}>
                          {TOTAL_STATION_KIT_ITEMS.length} accesorios incluidos en el préstamo
                        </Text>
                      </View>
                    </View>
                    <View style={styles.kitToggleBtn}>
                      <Text style={styles.kitToggleText}>
                        {showKitDetails ? 'Ocultar' : 'Ver detalles'}
                      </Text>
                      <MaterialIcons
                        name={showKitDetails ? 'expand-less' : 'expand-more'}
                        size={18}
                        color={theme.color.navy}
                      />
                    </View>
                  </Pressable>

                  {showKitDetails ? (
                    <View style={styles.kitBody}>
                      <View style={styles.kitGrid}>
                        {TOTAL_STATION_KIT_ITEMS.map((acc, idx) => (
                          <View key={idx} style={styles.kitItem}>
                            <MaterialIcons name="check-circle" size={15} color={theme.color.success} />
                            <Text style={styles.kitItemText}>{acc}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.kitNote}>
                        * Estos artículos se entregan y deben devolverse completos junto con el equipo.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {isSelectedStation ? (
                <View style={styles.extrasCard}>
                  <View style={styles.extrasHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.extrasTitle}>Materiales extras (opcional)</Text>
                      <Text style={styles.extrasSubtitle}>
                        Pide materiales adicionales del inventario para tu práctica.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setExtraPickerOpen(true)}
                      style={styles.addExtraBtn}
                    >
                      <MaterialIcons name="add" size={16} color={theme.color.navy} />
                      <Text style={styles.addExtraBtnText}>Añadir extra</Text>
                    </Pressable>
                  </View>

                  {selectedExtras.length === 0 ? (
                    <View style={styles.extrasEmpty}>
                      <Text style={styles.extrasEmptyText}>
                        Sin extras agregados. Si requieres cinta de 30 m u otro material, pulsa “Añadir extra”.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.extrasList}>
                      {selectedExtras.map((extra) => (
                        <View key={extra.equipmentId} style={styles.extraItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.extraItemName} numberOfLines={1}>
                              {extra.name}
                            </Text>
                            <Text style={styles.extraItemCode}>{extra.internalCode}</Text>
                          </View>
                          <View style={styles.extraQtyWrap}>
                            <Pressable
                              style={styles.extraQtyBtn}
                              onPress={() => updateExtraQty(extra.equipmentId, -1)}
                            >
                              <MaterialIcons name="remove" size={14} color={theme.color.navy} />
                            </Pressable>
                            <Text style={styles.extraQtyText}>{extra.quantity}</Text>
                            <Pressable
                              style={styles.extraQtyBtn}
                              onPress={() => updateExtraQty(extra.equipmentId, 1)}
                            >
                              <MaterialIcons name="add" size={14} color={theme.color.navy} />
                            </Pressable>
                          </View>
                          <Pressable
                            onPress={() => removeExtra(extra.equipmentId)}
                            style={styles.removeExtraBtn}
                            hitSlop={6}
                          >
                            <MaterialIcons name="close" size={16} color={theme.color.red} />
                          </Pressable>
                        </View>
                      ))}
                      <View style={styles.extraNotice}>
                        <MaterialIcons name="sync" size={14} color="#92400E" />
                        <Text style={styles.extraNoticeText}>
                          Los extras se descontarán en tiempo real del inventario al confirmar.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.defaultHint}>
                <MaterialIcons name="schedule" size={18} color={theme.color.info} />
                <Text style={styles.defaultHintText}>El plazo de préstamo es de 24 hrs.</Text>
              </View>

              <Pressable
                onPress={() => setExtendTime((v) => !v)}
                style={styles.checkRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: extendTime }}
              >
                <MaterialIcons
                  name={extendTime ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={extendTime ? theme.color.navy : theme.color.muted}
                />
                <Text style={styles.checkLabel}>Solicitar por más tiempo</Text>
              </Pressable>

              {extendTime ? (
                <View style={styles.extendBlock}>
                  <Text style={styles.fieldLabel}>Nueva fecha de devolución</Text>
                  <AppDatePicker
                    value={resolvedDueAt ?? defaultDueAt}
                    minimumDate={defaultDueAt}
                    displayValue={customDueDisplay}
                    onChange={onPickCustomDate}
                  />
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  variant="secondary"
                  fullWidth={false}
                  style={styles.modalBtn}
                  disabled={submitting}
                  onPress={closeConfirm}
                />
                <Button
                  title="Añadir"
                  loading={submitting}
                  fullWidth={false}
                  style={styles.modalBtn}
                  onPress={onAddToCart}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de revisión y confirmación del pedido agrupado */}
      <Modal
        visible={cartModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submitting) setCartModalOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.cartModalCard, { maxHeight: Math.min(680, height - 32) }]}>
            <View style={styles.cartModalHead}>
              <View style={styles.cartModalIconWrap}>
                <MaterialIcons name="shopping-bag" size={24} color={theme.color.navy} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Tu pedido de material</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {cartItems.length}{' '}
                  {cartItems.length === 1
                    ? 'material listo para solicitar'
                    : 'materiales listos para solicitar'}
                </Text>
              </View>
              <Pressable
                onPress={() => setCartModalOpen(false)}
                disabled={submitting}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="close" size={22} color={theme.color.muted} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: '100%' }}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.cartItemsList}>
                {cartItems.map((c, index) => (
                  <View key={c.id} style={styles.cartItemCard}>
                    <View style={styles.cartItemCardHead}>
                      <View style={styles.cartItemIndex}>
                        <Text style={styles.cartItemIndexText}>{index + 1}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.cartItemName} numberOfLines={1}>
                          {c.equipment.name}
                        </Text>
                        <Text style={styles.cartItemMeta}>
                          {c.equipment.internalCode}
                          {c.equipment.brand ? ` · ${c.equipment.brand}` : ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => removeCartItem(c.id)}
                        disabled={submitting}
                        style={styles.cartItemRemoveBtn}
                        hitSlop={6}
                      >
                        <MaterialIcons name="delete-outline" size={20} color={theme.color.red} />
                      </Pressable>
                    </View>

                    <View style={styles.cartItemDueRow}>
                      <MaterialIcons name="schedule" size={15} color={theme.color.muted} />
                      <Text style={styles.cartItemDueText}>
                        Devolución: {formatDateTime(c.dueAt)}
                      </Text>
                      {c.extendTime ? (
                        <View style={styles.cartItemBadge}>
                          <Text style={styles.cartItemBadgeText}>Tiempo extendido</Text>
                        </View>
                      ) : null}
                    </View>

                    {c.kitItems && c.kitItems.length > 0 ? (
                      <View style={styles.cartItemKitBox}>
                        <MaterialIcons name="inventory-2" size={14} color={theme.color.navy} />
                        <Text style={styles.cartItemKitText}>
                          Kit básico incluido ({c.kitItems.length} accesorios)
                        </Text>
                      </View>
                    ) : null}

                    {c.extraItems && c.extraItems.length > 0 ? (
                      <View style={styles.cartItemExtrasBox}>
                        <Text style={styles.cartItemExtrasTitle}>Extras seleccionados:</Text>
                        {c.extraItems.map((ex) => (
                          <View key={ex.equipmentId} style={styles.cartItemExtraRow}>
                            <Text style={styles.cartItemExtraName} numberOfLines={1}>
                              • {ex.name}
                            </Text>
                            <Text style={styles.cartItemExtraQty}>x{ex.quantity}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              <View style={styles.cartOrderSummary}>
                <View style={styles.cartSummaryRow}>
                  <Text style={styles.cartSummaryLabel}>
                    {user?.role === 'renter' ? 'Modalidad' : 'Profesor'}
                  </Text>
                  <Text style={styles.cartSummaryValue}>
                    {user?.role === 'renter'
                      ? 'Renta particular'
                      : user?.role === 'teacher'
                        ? user.displayName
                        : (user?.teacherName ?? '—')}
                  </Text>
                </View>
                <View style={[styles.cartSummaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.cartSummaryLabel}>Total de materiales</Text>
                  <Text
                    style={[
                      styles.cartSummaryValue,
                      { color: theme.color.navy, fontWeight: '800' },
                    ]}
                  >
                    {cartItems.length} equipo{cartItems.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {/* <View style={styles.cartSummaryNote}>
                  <MaterialIcons name="info-outline" size={15} color={theme.color.info} />
                  <Text style={styles.cartSummaryNoteText}>
                    Se generará una única entrega para que el laboratorio te entregue todo junto.
                  </Text>
                </View> */}
              </View>

              <View style={styles.cartModalActions}>
                <Button
                  title="Añadir más material"
                  variant="secondary"
                  fullWidth={false}
                  style={styles.modalBtn}
                  disabled={submitting}
                  onPress={() => setCartModalOpen(false)}
                />
                <Button
                  title={`Confirmar pedido (${cartItems.length})`}
                  loading={submitting}
                  fullWidth={false}
                  style={styles.modalBtn}
                  onPress={onSubmitCartOrder}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Submodal selector de materiales extras */}
      <Modal
        visible={extraPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExtraPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: Math.min(560, height - 40) }]}>
            <View style={styles.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Añadir material extra</Text>
                <Text style={styles.modalSubtitle}>
                  Elige un artículo disponible en el inventario
                </Text>
              </View>
              <Pressable onPress={() => setExtraPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={theme.color.muted} />
              </Pressable>
            </View>

            <View style={styles.pickerSearch}>
              <MaterialIcons name="search" size={18} color={theme.color.muted} />
              <TextInput
                value={extraSearch}
                onChangeText={setExtraSearch}
                placeholder="Buscar cinta, prisma, flexómetro..."
                placeholderTextColor={theme.color.muted}
                style={styles.pickerSearchInput}
                autoFocus
              />
              {extraSearch ? (
                <Pressable onPress={() => setExtraSearch('')} hitSlop={6}>
                  <MaterialIcons name="clear" size={16} color={theme.color.muted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {selectableExtras.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: theme.color.muted, fontSize: 13, textAlign: 'center' }}>
                    No se encontraron materiales disponibles para agregar como extra.
                  </Text>
                </View>
              ) : (
                selectableExtras.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => addExtra(item)}
                    style={({ pressed }) => [
                      styles.pickerItemRow,
                      pressed && { backgroundColor: theme.color.infoSoft },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.pickerItemMeta}>
                        {item.internalCode} {item.brand ? `· ${item.brand}` : ''}
                      </Text>
                    </View>
                    <View style={styles.pickerStockBadge}>
                      <Text style={styles.pickerStockText}>{item.qtyAvailable} disp.</Text>
                    </View>
                    <View style={styles.pickerAddBtn}>
                      <MaterialIcons name="add" size={18} color={theme.color.navy} />
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <Button
              title="Cerrar"
              variant="secondary"
              onPress={() => setExtraPickerOpen(false)}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={successOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <MaterialIcons name="check-circle" size={42} color={theme.color.success} />
            </View>
            <Text style={styles.successTitle}>
              {createdCount > 1 ? '¡Pedido confirmado!' : 'Pedido confirmado'}
            </Text>
            <Text style={styles.successSubtitle}>
              {createdCount > 1
                ? `Se registraron con éxito ${createdCount} materiales en tu solicitud. Quedaron agrupados para su entrega.`
                : 'Tu solicitud se registró correctamente.'}
            </Text>
            <View style={styles.folioBox}>
              <Text style={styles.folioLabel}>
                {createdCount > 1 ? 'Folios de solicitud' : 'Número de pedido'}
              </Text>
              <Text style={styles.folioValue}>{successFolio ?? '—'}</Text>
            </View>
            <Button title="Entendido" onPress={() => setSuccessOpen(false)} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>

      <Toast message={toast} visible={toastVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 28, paddingBottom: 100 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
    flexWrap: 'wrap',
  },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
  },
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
    marginTop: 12,
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
  },
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
  },
  searchInput: { flex: 1, color: theme.color.ink, fontSize: theme.font.size.md, outlineStyle: 'none' as unknown as undefined },
  sectionTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionHint: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  tile: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
    ...theme.shadow.soft,
  },
  tilePressed: { opacity: 0.9, borderColor: '#C5D8F0' },
  tileMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tileMarkText: { color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.md },
  tileName: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  tileHint: { color: theme.color.muted, fontSize: theme.font.size.sm, minHeight: 36 },
  tileFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tileCount: { color: theme.color.success, fontSize: theme.font.size.sm, fontWeight: '800' },
  tileItems: { color: theme.color.muted, fontSize: theme.font.size.sm },
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
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EEF2F6',
  },
  backText: { color: theme.color.navy, fontSize: theme.font.size.md, fontWeight: '700' },
  groupTitleBlock: { flex: 1, minWidth: 160 },
  groupEyebrow: { color: theme.color.muted, fontSize: theme.font.size.sm },
  groupTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
  },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.color.successSoft,
  },
  groupBadgeText: {
    color: theme.color.success,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
  },
  list: { gap: 4, marginBottom: 16 },
  requestBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
    ...theme.shadow.soft,
  },
  requestLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  requestValue: {
    marginTop: 4,
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
  },
  requestBtn: { minWidth: 180, paddingHorizontal: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: theme.color.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  modalTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
  },
  modalSubtitle: {
    marginTop: 6,
    marginBottom: 16,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
  },
  kitCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  kitHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F1F5F9',
    gap: 8,
  },
  kitHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  kitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kitTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },
  kitSubtitle: {
    color: theme.color.muted,
    fontSize: 11,
    marginTop: 2,
  },
  kitToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  kitToggleText: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  kitBody: {
    padding: 12,
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  kitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
    minWidth: 180,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  kitItemText: {
    flex: 1,
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  kitNote: {
    marginTop: 10,
    color: theme.color.muted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  extrasCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    marginBottom: 12,
    padding: 12,
  },
  extrasHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  extrasTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },
  extrasSubtitle: {
    color: theme.color.muted,
    fontSize: 11,
    marginTop: 2,
  },
  addExtraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  addExtraBtnText: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  extrasEmpty: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    alignItems: 'center',
  },
  extrasEmptyText: {
    color: theme.color.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  extrasList: {
    gap: 8,
  },
  extraItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  extraItemName: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  extraItemCode: {
    color: theme.color.muted,
    fontSize: 11,
    marginTop: 1,
  },
  extraQtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.color.surface,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  extraQtyBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  extraQtyText: {
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
  removeExtraBtn: {
    padding: 4,
  },
  extraNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
  },
  extraNoticeText: {
    flex: 1,
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerSearch: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
  },
  pickerSearchInput: {
    flex: 1,
    color: theme.color.ink,
    fontSize: 14,
    outlineStyle: 'none' as unknown as undefined,
  },
  pickerList: {
    maxHeight: 280,
  },
  pickerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  pickerItemName: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerItemMeta: {
    color: theme.color.muted,
    fontSize: 11,
    marginTop: 2,
  },
  pickerStockBadge: {
    backgroundColor: theme.color.successSoft,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pickerStockText: {
    color: theme.color.success,
    fontSize: 11,
    fontWeight: '800',
  },
  pickerAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F6',
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { color: theme.color.muted, fontSize: theme.font.size.md },
  summaryValue: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
    textAlign: 'right',
  },
  defaultHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
    marginBottom: 12,
  },
  defaultHintText: {
    flex: 1,
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '600',
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  checkLabel: { color: theme.color.ink, fontSize: theme.font.size.md, fontWeight: '700' },
  extendBlock: { marginBottom: 12 },
  fieldLabel: {
    color: theme.color.navy,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: { flex: 1 },
  successCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.successSoft,
    marginBottom: 12,
  },
  successTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
  },
  successSubtitle: {
    marginTop: 6,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    textAlign: 'center',
  },
  folioBox: {
    marginTop: 16,
    width: '100%',
    padding: 14,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
  },
  folioLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  folioValue: {
    marginTop: 4,
    color: theme.color.navy,
    fontSize: theme.font.size.xl,
    fontWeight: '800',
  },
  cartModalCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: theme.color.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.color.navy,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    ...theme.shadow.soft,
  },
  headerOrderBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  groupOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.color.navy,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 'auto',
    ...theme.shadow.soft,
  },
  groupOrderBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  rowAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.color.navy,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  rowAddBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  rowInCartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.color.successSoft,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  rowInCartText: {
    color: theme.color.success,
    fontSize: 12,
    fontWeight: '800',
  },
  rowUnavailableBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  rowUnavailableText: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  floatingPillContainer: {
    position: 'absolute',
    bottom: 24,
    right: 28,
    zIndex: 99,
  },
  floatingPillContainerCompact: {
    bottom: 16,
    right: 16,
    left: 16,
    alignItems: 'stretch',
  },
  floatingCartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.color.navy,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 9999,
    shadowColor: '#0F294A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  floatingPillIconWrap: {
    position: 'relative',
  },
  floatingPillBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: theme.color.success,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  floatingPillBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  floatingPillTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  cartModalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cartModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemsList: {
    gap: 10,
    marginBottom: 16,
  },
  cartItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  cartItemCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartItemIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.color.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemIndexText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  cartItemName: {
    color: theme.color.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  cartItemMeta: {
    color: theme.color.muted,
    fontSize: 12,
    marginTop: 2,
  },
  cartItemRemoveBtn: {
    padding: 4,
  },
  cartItemDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
  },
  cartItemDueText: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  cartItemBadge: {
    backgroundColor: theme.color.infoSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  cartItemBadgeText: {
    color: theme.color.navy,
    fontSize: 10,
    fontWeight: '700',
  },
  cartItemKitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: theme.color.infoSoft,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  cartItemKitText: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '700',
  },
  cartItemExtrasBox: {
    marginTop: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 8,
  },
  cartItemExtrasTitle: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  cartItemExtraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  cartItemExtraName: {
    color: '#78350F',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  cartItemExtraQty: {
    color: '#78350F',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 8,
  },
  cartOrderSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 12,
    marginBottom: 16,
  },
  cartSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  cartSummaryLabel: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },
  cartSummaryValue: {
    color: theme.color.ink,
    fontSize: theme.font.size.sm,
    fontWeight: '700',
  },
  cartSummaryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 8,
    backgroundColor: theme.color.infoSoft,
    borderRadius: 6,
  },
  cartSummaryNoteText: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  cartModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
