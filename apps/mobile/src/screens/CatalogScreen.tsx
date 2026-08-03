import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { watchEquipment, createLoanRequest } from '@lab-topo/services';
import { Avatar, Button, MaterialCard, Notice, Toast } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

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

/** DD/MM/AAAA + hora/minuto/segundo de `timeSource` → Date */
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

export function CatalogScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestAt, setRequestAt] = useState(() => new Date());
  const [defaultDueAt, setDefaultDueAt] = useState(() => new Date(Date.now() + MS_24H));
  const [extendTime, setExtendTime] = useState(false);
  const [customDueDisplay, setCustomDueDisplay] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
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
      },
      { onlyActive: true }
    );
    return unsub;
  }, []);

  const availableItems = useMemo(
    () => items.filter((e) => e.status === 'available' || e.qtyAvailable > 0),
    [items]
  );

  const categories = useMemo(
    (): CategoryGroup[] => buildCategoryGroups(availableItems),
    [availableItems]
  );

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
    const base = availableItems.filter((e) => categoryIdOf(e) === selectedCategoryId);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => {
      const hay = `${e.name} ${e.internalCode} ${e.brand ?? ''} ${e.model ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [availableItems, selectedCategoryId, search]);

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
    const ready =
      user?.role === 'teacher'
        ? Boolean(user.uid && user.displayName)
        : user?.role === 'renter'
          ? Boolean(user.uid && user.renterStatus === 'approved')
          : Boolean(user?.teacherId && user.teacherName);
    if (!ready) {
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
      showToast('Fecha inválida. Elige una fecha en el calendario.');
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

  const onPickDate = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed' || !date) return;

    const merged = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      defaultDueAt.getHours(),
      defaultDueAt.getMinutes(),
      defaultDueAt.getSeconds(),
      defaultDueAt.getMilliseconds()
    );
    setCustomDueDisplay(toDisplayDate(merged));
  };

  const closeSuccess = () => {
    setSuccessOpen(false);
    setSuccessFolio(null);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={[
          styles.scroll,
          selectedCategoryId ? styles.scrollWithFooter : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Bienvenido</Text>
            <Text style={styles.name}>{user?.displayName ?? 'Alumno'}</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'AL')} size={26} />
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

        {error ? <Notice tone="danger" title="No se pudo cargar el catálogo" description={error} /> : null}

        {loading ? (
          <ActivityIndicator color={theme.color.navy} style={{ marginTop: 18 }} />
        ) : !selectedCategoryId ? (
          <>
            <Text style={styles.label}>Grupos de material</Text>
            <Text style={styles.helperTop}>Elige un grupo para ver el equipo.</Text>

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
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>
                  {categoryItems.length} disp.
                </Text>
              </View>
            </View>

            {categoryItems.length === 0 ? (
              <Notice
                title="Sin equipos en este grupo"
                description="Prueba otro grupo o limpia el buscador."
              />
            ) : (
              categoryItems.map((item) => (
                <MaterialCard
                  key={item.id}
                  equipment={item}
                  selected={item.id === selectedEquipmentId}
                  onPress={() => setSelectedEquipmentId(item.id)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {selectedCategoryId ? (
        <View style={styles.stickyFooter}>
          <Button
            title="Solicitar material"
            disabled={!selectedEquipment}
            onPress={openConfirm}
          />
        </View>
      ) : null}

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={closeConfirm}>
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>Confirmar solicitud</Text>
                <Pressable onPress={closeConfirm} hitSlop={8} disabled={submitting}>
                  <MaterialIcons name="close" size={20} color={theme.color.muted} />
                </Pressable>
              </View>

              <Text style={styles.modalSubtitle}>
                Revisa el material y el plazo de devolución antes de enviar.
              </Text>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Material</Text>
                  <Text style={styles.summaryValue}>{selectedEquipment?.name ?? '—'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Código</Text>
                  <Text style={styles.summaryValue}>
                    {selectedEquipment?.internalCode ?? '—'}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Profesor</Text>
                  <Text style={styles.summaryValue}>{user?.teacherName ?? '—'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Fecha de solicitud</Text>
                  <Text style={styles.summaryValue}>{formatDateTime(requestAt)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryRowLast]}>
                  <Text style={styles.summaryLabel}>Fecha de devolución</Text>
                  <Text style={[styles.summaryValue, { color: theme.color.navy }]}>
                    {resolvedDueAt ? formatDateTime(resolvedDueAt) : 'Fecha inválida'}
                  </Text>
                </View>
              </View>

              <View style={styles.defaultHint}>
                <MaterialIcons name="schedule" size={16} color={theme.color.info} />
                <Text style={styles.defaultHintText}>
                  El plazo de préstamo es de 24hrs.
                </Text>
              </View>

              <Pressable
                onPress={() => setExtendTime((v) => !v)}
                style={styles.checkRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: extendTime }}
              >
                <MaterialIcons
                  name={extendTime ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={extendTime ? theme.color.navy : theme.color.muted}
                />
                <Text style={styles.checkLabel}>Solicitar por más tiempo</Text>
              </Pressable>

              {extendTime ? (
                <View style={styles.extendBlock}>
                  <Text style={styles.label}>Nueva fecha de devolución</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={styles.dateField}
                    accessibilityRole="button"
                    accessibilityLabel="Elegir fecha de devolución"
                  >
                    <Text style={styles.dateValue}>{customDueDisplay || 'DD/MM/AAAA'}</Text>
                    <MaterialIcons name="event" size={20} color={theme.color.navy} />
                  </Pressable>

                  {showDatePicker ? (
                    <DateTimePicker
                      value={resolvedDueAt ?? defaultDueAt}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={defaultDueAt}
                      onChange={onPickDate}
                    />
                  ) : null}

                  {Platform.OS === 'ios' && showDatePicker ? (
                    <Button
                      title="Listo"
                      variant="secondary"
                      onPress={() => setShowDatePicker(false)}
                      style={{ marginTop: 8, height: 40 }}
                    />
                  ) : null}
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
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={successOpen} transparent animationType="fade" onRequestClose={closeSuccess}>
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

            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>A la espera de confirmación</Text>
            </View>

            <Button title="Entendido" onPress={closeSuccess} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>

      <Toast message={toast} visible={toastVisible} />
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
    paddingBottom: 16,
  },
  scrollWithFooter: {
    paddingBottom: 8,
  },
  stickyFooter: {
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    backgroundColor: theme.color.canvasMobile,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  hello: {
    color: theme.color.muted,
    fontSize: 11,
  },
  name: {
    color: theme.color.navy,
    fontSize: 18,
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
  label: {
    marginBottom: 6,
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  helperTop: {
    marginTop: -2,
    marginBottom: 12,
    color: theme.color.muted,
    fontSize: 10,
    lineHeight: 14,
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
    marginBottom: 14,
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
  groupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: theme.color.successSoft,
  },
  groupBadgeText: {
    color: theme.color.success,
    fontSize: 10,
    fontWeight: '800',
  },
  helper: {
    marginTop: 8,
    color: theme.color.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 33, 43, 0.45)',
    justifyContent: 'center',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  modalCard: {
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 16,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    color: theme.color.navy,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    color: theme.color.muted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FBFCFD',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    color: theme.color.muted,
    fontSize: 11,
  },
  summaryValue: {
    flex: 1,
    color: theme.color.ink,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  defaultHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
  },
  defaultHintText: {
    flex: 1,
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  checkLabel: {
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  extendBlock: {
    marginBottom: 4,
  },
  dateField: {
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateValue: {
    color: theme.color.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    height: 42,
  },
  successCard: {
    marginHorizontal: 22,
    backgroundColor: theme.color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 20,
    alignItems: 'center',
  },
  successIconWrap: {
    marginBottom: 10,
  },
  successTitle: {
    color: theme.color.navy,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  successSubtitle: {
    marginTop: 6,
    color: theme.color.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  folioBox: {
    marginTop: 16,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    borderWidth: 1,
    borderColor: '#CBDCF1',
    alignItems: 'center',
  },
  folioLabel: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  folioValue: {
    marginTop: 6,
    color: theme.color.navy,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statusPill: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.color.warningSoft,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.color.warning,
  },
  statusText: {
    color: theme.color.warning,
    fontSize: 11,
    fontWeight: '700',
  },
});
