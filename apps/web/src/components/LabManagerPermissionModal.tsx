import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import { hasEquipmentEditPermission, type AppUser } from '@lab-topo/domain';
import { setEquipmentEditPermission } from '@lab-topo/services';
import { Button, Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { formatMexicoDate } from '../lib/reportGenerator';
import { AppDatePicker } from './AppDatePicker';

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysToToday(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

type LabManagerPermissionModalProps = {
  visible: boolean;
  targetUser: AppUser | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function LabManagerPermissionModal({
  visible,
  targetUser,
  onClose,
  onSuccess,
}: LabManagerPermissionModalProps) {
  const { user: currentAdmin } = useAuth();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;

  const [selectedDate, setSelectedDate] = useState<Date>(() => addDaysToToday(3));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentlyActive = useMemo(
    () => hasEquipmentEditPermission(targetUser),
    [targetUser]
  );

  useEffect(() => {
    if (visible && targetUser) {
      setError(null);
      setNotes(targetUser.equipmentEditNotes || '');
      if (targetUser.equipmentEditUntil) {
        const parts = targetUser.equipmentEditUntil.split('T')[0].split('-').map(Number);
        if (parts.length === 3) {
          const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
          if (!Number.isNaN(parsed.getTime()) && parsed.getTime() >= Date.now()) {
            setSelectedDate(parsed);
            return;
          }
        }
      }
      setSelectedDate(addDaysToToday(3));
    }
  }, [visible, targetUser]);

  if (!visible || !targetUser) return null;

  const handleGrant = async () => {
    if (!currentAdmin) return;
    setError(null);

    const isoDate = toIsoDate(selectedDate);
    const todayIso = toIsoDate(new Date());

    if (isoDate < todayIso) {
      setError('La fecha límite debe ser igual o posterior al día de hoy.');
      return;
    }

    setSaving(true);
    try {
      await setEquipmentEditPermission({
        targetUserId: targetUser.uid,
        targetUserName: targetUser.displayName,
        targetUserEmail: targetUser.email,
        equipmentEditUntil: isoDate,
        notes: notes.trim() || null,
        actor: {
          uid: currentAdmin.uid,
          email: currentAdmin.email,
          displayName: currentAdmin.displayName,
          role: currentAdmin.role,
        },
        labId: currentAdmin.labId,
      });

      const formatted = formatMexicoDate(isoDate);
      onSuccess(`Permiso de edición asignado a ${targetUser.displayName} hasta el ${formatted}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el permiso.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!currentAdmin) return;
    setError(null);
    setSaving(true);
    try {
      await setEquipmentEditPermission({
        targetUserId: targetUser.uid,
        targetUserName: targetUser.displayName,
        targetUserEmail: targetUser.email,
        equipmentEditUntil: null,
        notes: 'Permiso revocado manualmente por el administrador.',
        actor: {
          uid: currentAdmin.uid,
          email: currentAdmin.email,
          displayName: currentAdmin.displayName,
          role: currentAdmin.role,
        },
        labId: currentAdmin.labId,
      });

      onSuccess(`Permiso de edición revocado a ${targetUser.displayName}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar el permiso.');
    } finally {
      setSaving(false);
    }
  };

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, isMobile && { padding: 12 }]}>
        <View
          style={[
            styles.modalCard,
            isMobile && styles.modalCardMobile,
            { maxHeight: Math.min(680, height - (isMobile ? 24 : 48)) },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeaderRow}>
            <View style={styles.modalIconWrap}>
              <MaterialIcons name="vpn-key" size={24} color={theme.color.navy} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Permiso temporal de Gestión de Equipos
              </Text>
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                Autoriza al encargado de laboratorio a crear, editar y dar mantenimiento al inventario.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseBtn} accessibilityLabel="Cerrar">
              <MaterialIcons name="close" size={20} color={theme.color.muted} />
            </Pressable>
          </View>

          {/* Cuerpo */}
          <ScrollView
            style={styles.modalScrollBody}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Tarjeta de usuario receptor */}
            <View style={styles.userSummaryBox}>
              <View style={styles.userSummaryRow}>
                <Text style={styles.userSummaryLabel}>Encargado asignado</Text>
                <Text style={styles.userSummaryName}>{targetUser.displayName}</Text>
              </View>
              <View style={styles.userSummaryRow}>
                <Text style={styles.userSummaryLabel}>Correo institucional</Text>
                <Text style={styles.userSummaryValue}>{targetUser.email || 'Sin correo'}</Text>
              </View>
              <View style={[styles.userSummaryRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.userSummaryLabel}>Estado actual</Text>
                <View
                  style={[
                    styles.statusBadge,
                    isCurrentlyActive ? styles.statusBadgeActive : styles.statusBadgeInactive,
                  ]}
                >
                  <MaterialIcons
                    name={isCurrentlyActive ? 'check-circle' : 'lock-clock'}
                    size={14}
                    color={isCurrentlyActive ? theme.color.success : theme.color.muted}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isCurrentlyActive ? styles.statusTextActive : styles.statusTextInactive,
                    ]}
                  >
                    {isCurrentlyActive
                      ? `Permiso activo hasta ${formatMexicoDate(targetUser.equipmentEditUntil)}`
                      : targetUser.equipmentEditUntil
                      ? `Expiró el ${formatMexicoDate(targetUser.equipmentEditUntil)}`
                      : 'Sin permiso de edición activo'}
                  </Text>
                </View>
              </View>
            </View>

            {error ? (
              <View style={{ marginBottom: 14 }}>
                <Notice tone="danger" title="Atención" description={error} />
              </View>
            ) : null}

            {/* Selector de Fecha Límite con Calendario */}
            <View style={styles.fieldBlock}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Fecha límite del permiso (Calendario):</Text>
                <Text style={styles.fieldHint}>El permiso expirará al terminar este día</Text>
              </View>

              <AppDatePicker
                value={selectedDate}
                minimumDate={todayDate}
                displayValue={formatMexicoDate(toIsoDate(selectedDate))}
                placeholder="DD/MM/AAAA"
                accessibilityLabel="Elegir fecha límite de permiso en calendario"
                onChange={(d) => {
                  setSelectedDate(d);
                  setError(null);
                }}
              />
            </View>

            {/* Accesos rápidos de duración */}
            <View style={styles.shortcutsSection}>
              <Text style={styles.shortcutsTitle}>Plazos rápidos recomendados:</Text>
              <View style={styles.chipsRow}>
                {[
                  { label: '+24 horas (Mañana)', days: 1 },
                  { label: '+3 días', days: 3 },
                  { label: '+7 días (1 sem.)', days: 7 },
                  { label: '+15 días', days: 15 },
                  { label: '+30 días (1 mes)', days: 30 },
                ].map((item) => {
                  const targetIso = toIsoDate(addDaysToToday(item.days));
                  const isSelected = toIsoDate(selectedDate) === targetIso;
                  return (
                    <Pressable
                      key={item.label}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => {
                        setSelectedDate(addDaysToToday(item.days));
                        setError(null);
                      }}
                    >
                      <MaterialIcons
                        name={isSelected ? 'check' : 'add'}
                        size={14}
                        color={isSelected ? theme.color.navy : theme.color.muted}
                      />
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Motivo o notas adicionales */}
            <View style={styles.notesBlock}>
              <Text style={styles.fieldLabel}>Motivo o justificación del permiso (opcional):</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ej. Inventario anual de octubre, actualización de códigos y fotos de equipos..."
                placeholderTextColor={theme.color.muted}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />
            </View>

            {/* Nota de auditoría */}
            <View style={styles.auditNotice}>
              <MaterialIcons name="policy" size={16} color={theme.color.navy} />
              <Text style={styles.auditNoticeText}>
                Esta asignación quedará registrada en la bitácora de auditoría para supervisión del
                superadministrador con tu firma institucional.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalActions}>
            {isCurrentlyActive && (
              <Button
                title="Revocar permiso"
                variant="danger"
                fullWidth={false}
                disabled={saving}
                style={styles.revokeBtn}
                onPress={handleRevoke}
              />
            )}
            <Button
              title="Cancelar"
              variant="secondary"
              fullWidth={false}
              disabled={saving}
              style={{ minWidth: 90 }}
              onPress={onClose}
            />
            <Button
              title={isCurrentlyActive ? 'Actualizar fecha límite' : 'Guardar y autorizar'}
              loading={saving}
              fullWidth={false}
              style={{ flex: 1 }}
              onPress={handleGrant}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  modalCardMobile: {
    borderRadius: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
    backgroundColor: '#FAFCFF',
  },
  modalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 102, 216, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.color.navy,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.color.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 6,
  },
  modalScrollBody: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  userSummaryBox: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  userSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
    gap: 8,
    flexWrap: 'wrap',
  },
  userSummaryLabel: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  userSummaryName: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  userSummaryValue: {
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: theme.color.successSoft,
  },
  statusBadgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: theme.color.success,
  },
  statusTextInactive: {
    color: theme.color.muted,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  fieldLabel: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  fieldHint: {
    color: theme.color.muted,
    fontSize: 11,
  },
  shortcutsSection: {
    marginBottom: 16,
  },
  shortcutsTitle: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: theme.color.infoSoft,
    borderColor: theme.color.navy,
  },
  chipText: {
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: theme.color.navy,
    fontWeight: '700',
  },
  notesBlock: {
    marginBottom: 14,
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    padding: 10,
    minHeight: 70,
    textAlignVertical: 'top',
    color: theme.color.ink,
    backgroundColor: '#fff',
    fontSize: theme.font.size.sm,
  },
  auditNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  auditNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
    backgroundColor: '#FAFCFF',
    flexWrap: 'wrap',
  },
  revokeBtn: {
    marginRight: 'auto',
  },
});
