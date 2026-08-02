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

export function CatalogScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Equipment[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
        setSelectedEquipmentId((current) => {
          if (current) return current;
          const firstAvailable = next.find((e) => e.qtyAvailable > 0 && e.status === 'available');
          return firstAvailable?.id ?? null;
        });
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = items.filter((e) => e.status === 'available' || e.qtyAvailable > 0);
    if (!q) return base;
    return base.filter((e) => {
      const hay = `${e.name} ${e.internalCode} ${e.brand ?? ''} ${e.model ?? ''} ${e.categoryName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const selectedEquipment = items.find((e) => e.id === selectedEquipmentId) ?? null;
  const selectedTeacher = teachers.find((t) => t.uid === selectedTeacherId) ?? null;

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
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
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View>
            <Text style={styles.hello}>Buenos días,</Text>
            <Text style={styles.name}>{user?.displayName ?? 'Alumno'}</Text>
          </View>
          <Avatar initials={getInitials(user?.displayName ?? 'AL')} size={26} />
        </View>

        <View style={styles.search}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar estación, nivel..."
            placeholderTextColor={theme.color.muted}
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.label}>Material disponible</Text>

        {error ? <Notice tone="danger" title="No se pudo cargar el catálogo" description={error} /> : null}

        {loading ? (
          <ActivityIndicator color={theme.color.navy} style={{ marginTop: 18 }} />
        ) : filtered.length === 0 ? (
          <Notice
            title="Sin equipos"
            description="No hay material disponible. Ejecuta npm run seed:equipment si el inventario está vacío."
          />
        ) : (
          filtered.map((item) => (
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
