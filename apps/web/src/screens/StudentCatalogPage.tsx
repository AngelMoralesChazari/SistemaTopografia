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
import { theme } from '@lab-topo/config';
import {
  buildCategoryGroups,
  categoryIdOf,
  getInitials,
  RENTAL_TEACHER_ID,
  RENTAL_TEACHER_NAME,
  type CategoryGroup,
  type Equipment,
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
  const [successOpen, setSuccessOpen] = useState(false);
  const [successFolio, setSuccessFolio] = useState<string | null>(null);

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

  const openConfirm = () => {
    if (!selectedEquipment) {
      showToast('Selecciona un equipo de la lista antes de continuar.');
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
    setConfirmOpen(true);
  };

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

  const onConfirmRequest = async () => {
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

    setSubmitting(true);
    try {
      const created = await createLoanRequest({
        labId: user.labId,
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.name,
        equipmentCode: selectedEquipment.internalCode,
        studentId: user.uid,
        studentName: user.displayName,
        studentNumber: user.studentId ?? user.employeeId ?? user.rfc ?? null,
        teacherId: teacher.teacherId,
        teacherName: teacher.teacherName,
        dueAt: resolvedDueAt.toISOString(),
        loanType: user.role === 'renter' ? 'rental' : 'academic',
      });
      setConfirmOpen(false);
      setSuccessFolio(created.folio);
      setSuccessOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Catálogo de equipos</Text>
            <Text style={styles.subtitle}>Inventario activo del laboratorio de topografía.</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'AL')} size={40} />
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
            </View>

            {categoryItems.length === 0 ? (
              <Notice
                title="Sin equipos en este grupo"
                description="Prueba otro grupo o limpia el buscador."
              />
            ) : (
              <View style={styles.list}>
                {paging.pageItems.map((item) => (
                  <MaterialCard
                    key={item.id}
                    equipment={item}
                    selected={item.id === selectedEquipmentId}
                    onPress={() => setSelectedEquipmentId(item.id)}
                  />
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
              </View>
            )}

            <View style={styles.requestBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestLabel}>Equipo seleccionado</Text>
                <Text style={styles.requestValue} numberOfLines={1}>
                  {selectedEquipment?.name ?? 'Ninguno'}
                </Text>
              </View>
              <Button
                title="Solicitar material"
                fullWidth={false}
                disabled={!selectedEquipment}
                onPress={openConfirm}
                style={styles.requestBtn}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={closeConfirm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar solicitud</Text>
            <Text style={styles.modalSubtitle}>
              Revisa el material y el plazo de devolución antes de enviar.
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
                title="Confirmar"
                loading={submitting}
                fullWidth={false}
                style={styles.modalBtn}
                onPress={onConfirmRequest}
              />
            </View>
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
            <Text style={styles.successTitle}>Pedido confirmado</Text>
            <Text style={styles.successSubtitle}>Tu solicitud se registró correctamente.</Text>
            <View style={styles.folioBox}>
              <Text style={styles.folioLabel}>Número de pedido</Text>
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
  content: { padding: 28, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16,
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
    gap: 12,
  },
  tile: {
    width: '31%',
    minWidth: 180,
    flexGrow: 1,
    padding: 16,
    borderRadius: 12,
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
    maxWidth: 480,
    backgroundColor: theme.color.surface,
    borderRadius: 14,
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
});
