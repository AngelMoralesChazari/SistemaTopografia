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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import { getInitials, type Equipment } from '@lab-topo/domain';
import { listTeachers, watchEquipment, createLoanRequest } from '@lab-topo/services';
import type { AppUser } from '@lab-topo/domain';
import { Avatar, Button, MaterialCard, Notice, Toast } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

type CategoryGroup = {
  id: string;
  name: string;
  availableCount: number;
  totalItems: number;
  mark: string;
  hint: string;
};

const CATEGORY_META: Record<string, { mark: string; hint: string; order: number }> = {
  'cat-medicion': { mark: 'ME', hint: 'Cintas, estadales y ruedas', order: 1 },
  'cat-niveles': { mark: 'NV', hint: 'Niveles ópticos y digitales', order: 2 },
  'cat-angulos': { mark: 'AE', hint: 'Teodolitos y estaciones', order: 3 },
  'cat-gnss': { mark: 'GN', hint: 'Receptores GPS / GNSS', order: 4 },
  'cat-soporte': { mark: 'SA', hint: 'Trípodes, jalones y prismas', order: 5 },
  'cat-gabinete': { mark: 'DG', hint: 'Escuadras y planímetros', order: 6 },
  'cat-topografia': { mark: 'TO', hint: 'Equipos de topografía', order: 7 },
  'cat-accesorios': { mark: 'AC', hint: 'Accesorios diversos', order: 8 },
};

function metaFor(categoryId: string, categoryName: string) {
  return (
    CATEGORY_META[categoryId] ?? {
      mark: categoryName.slice(0, 2).toUpperCase(),
      hint: 'Material del laboratorio',
      order: 99,
    }
  );
}

export function CatalogScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Equipment[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    listTeachers(user?.labId)
      .then((list) => {
        if (!cancelled) setTeachers(list);
      })
      .catch(() => {
        if (!cancelled) setTeachers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.labId]);

  const availableItems = useMemo(
    () => items.filter((e) => e.status === 'available' || e.qtyAvailable > 0),
    [items]
  );

  const categories = useMemo((): CategoryGroup[] => {
    const map = new Map<string, CategoryGroup>();
    for (const item of availableItems) {
      const id = item.categoryId || `cat-${item.categoryName.toLowerCase()}`;
      const meta = metaFor(id, item.categoryName);
      const current = map.get(id);
      if (current) {
        current.totalItems += 1;
        current.availableCount += item.qtyAvailable;
      } else {
        map.set(id, {
          id,
          name: item.categoryName,
          availableCount: item.qtyAvailable,
          totalItems: 1,
          mark: meta.mark,
          hint: meta.hint,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const oa = metaFor(a.id, a.name).order;
      const ob = metaFor(b.id, b.name).order;
      return oa - ob || a.name.localeCompare(b.name, 'es');
    });
  }, [availableItems]);

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
    const base = availableItems.filter((e) => {
      const id = e.categoryId || `cat-${e.categoryName.toLowerCase()}`;
      return id === selectedCategoryId;
    });
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => {
      const hay = `${e.name} ${e.internalCode} ${e.brand ?? ''} ${e.model ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [availableItems, selectedCategoryId, search]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const selectedEquipment = items.find((e) => e.id === selectedEquipmentId) ?? null;
  const selectedTeacher = teachers.find((t) => t.uid === selectedTeacherId) ?? null;

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

  const onRequest = async () => {
    if (!user) return;
    if (!selectedEquipment) {
      showToast('Selecciona un equipo antes de continuar.');
      return;
    }
    if (!selectedTeacher) {
      showToast('Selecciona un Profesor Responsable antes de continuar.');
      return;
    }
    setSubmitting(true);
    try {
      await createLoanRequest({
        labId: user.labId,
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.name,
        equipmentCode: selectedEquipment.internalCode,
        studentId: user.uid,
        studentName: user.displayName,
        studentNumber: user.studentId ?? null,
        teacherId: selectedTeacher.uid,
        teacherName: selectedTeacher.displayName,
        loanType: 'academic',
      });
      showToast('Solicitud enviada al Supervisor. Estado: pendiente.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.helperTop}>
              Elige un grupo para ver el equipo.
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
        ) : (
          <>
            <Pressable onPress={backToGroups} style={styles.backRow} hitSlop={8}>
              <Text style={styles.backText}>← Grupos</Text>
            </Pressable>

            <View style={styles.groupHead}>
              <Text style={styles.label}>{selectedCategory?.name ?? 'Material'}</Text>
              <Text style={styles.groupMeta}>
                {categoryItems.length} disponible{categoryItems.length === 1 ? '' : 's'}
              </Text>
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

            <Text style={styles.sectionLabel}>Nueva solicitud</Text>

            <Text style={styles.label}>Equipo seleccionado</Text>
            <View style={styles.select}>
              <Text style={styles.selectText}>
                {selectedEquipment?.name ?? 'Seleccionar equipo...'}
              </Text>
              <Text style={styles.selectChevron}>⌄</Text>
            </View>

            <Text style={styles.label}>Profesor Responsable</Text>
            <View style={styles.teacherList}>
              {teachers.length === 0 ? (
                <Text style={styles.helper}>
                  No hay maestros listados. Publica las reglas actualizadas o usa el seed de usuarios.
                </Text>
              ) : (
                teachers.map((teacher) => {
                  const active = teacher.uid === selectedTeacherId;
                  return (
                    <Pressable
                      key={teacher.uid}
                      onPress={() => setSelectedTeacherId(teacher.uid)}
                      style={[styles.teacherChip, active && styles.teacherChipActive]}
                    >
                      <Text style={[styles.teacherChipText, active && styles.teacherChipTextActive]}>
                        {teacher.displayName}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            <Button title="Solicitar material" loading={submitting} onPress={onRequest} />
            <Text style={styles.helper}>
              El encargado recibirá tu solicitud y confirmará la entrega en el laboratorio.
            </Text>
          </>
        )}
      </ScrollView>

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
  scroll: {
    paddingBottom: 28,
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
  backRow: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingVertical: 2,
  },
  backText: {
    color: theme.color.info,
    fontSize: 12,
    fontWeight: '700',
  },
  groupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  groupMeta: {
    color: theme.color.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  select: {
    height: 35,
    marginBottom: 13,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 6,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: '#536273',
    fontSize: 12,
  },
  selectChevron: {
    color: theme.color.muted,
    fontSize: 14,
  },
  teacherList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },
  teacherChip: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  teacherChipActive: {
    borderColor: theme.color.navy,
    backgroundColor: theme.color.infoSoft,
  },
  teacherChipText: {
    color: '#536273',
    fontSize: 11,
    fontWeight: '600',
  },
  teacherChipTextActive: {
    color: theme.color.navy,
    fontWeight: '800',
  },
  helper: {
    marginTop: 8,
    color: theme.color.muted,
    fontSize: 10,
    lineHeight: 14,
  },
});
