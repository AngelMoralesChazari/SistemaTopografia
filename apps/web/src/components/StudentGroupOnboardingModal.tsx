import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import { TOPOGRAPHY_GROUPS } from '@lab-topo/domain';
import {
  assignStudentAcademicGroup,
  extractStudentIdFromEmail,
} from '@lab-topo/services';
import { Button, Notice, TextField } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

export function StudentGroupOnboardingModal() {
  const { user, reloadUser } = useAuth();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [studentId, setStudentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const isStudentNeedingGroup =
    !!user &&
    user.role === 'student' &&
    (!user.groupIds || user.groupIds.length === 0);

  useEffect(() => {
    if (user?.email) {
      const detected = user.studentId || extractStudentIdFromEmail(user.email) || '';
      setStudentId(detected);
    }
  }, [user?.email, user?.studentId]);

  if (!isStudentNeedingGroup) {
    return null;
  }

  const handleConfirm = async () => {
    if (!user || !selectedGroup) {
      setError('Por favor selecciona tu grupo de Topografía.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await assignStudentAcademicGroup(
        user.uid,
        selectedGroup,
        studentId.trim() || null,
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
        user.labId
      );

      const msg = res.teacherId
        ? `¡Grupo ${res.groupCode} asignado! Tu maestro asignado es ${res.teacherName}.`
        : `¡Grupo ${res.groupCode} asignado! Tu aula aún no tiene maestro asignado (Pendiente de asignación).`;

      setSuccessInfo(msg);

      setTimeout(async () => {
        try {
          await reloadUser();
        } finally {
          setSubmitting(false);
        }
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo asignar el grupo. Intenta nuevamente.'
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="school" size={28} color={theme.color.navy} />
            </View>
            <Text style={styles.title}>¡Bienvenido a Topografía UAGro!</Text>
            <Text style={styles.subtitle}>
              Hola, <Text style={styles.bold}>{user.displayName}</Text>. Para vincularte
              con tu profesor y poder solicitar materiales para tus prácticas, selecciona tu grupo académico:
            </Text>
          </View>

          {error ? <Notice tone="danger" title={error} /> : null}

          {successInfo ? (
            <Notice
              tone="info"
              title="Grupo asignado correctamente"
              description={successInfo}
            />
          ) : null}

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Matrícula */}
            <View style={styles.studentIdBox}>
              <TextField
                label="Matrícula de estudiante (opcional)"
                value={studentId}
                onChangeText={setStudentId}
                placeholder="Ej: 24722899"
                keyboardType="numeric"
              />
              <Text style={styles.studentIdHint}>
                Si tu correo institucional incluye tu matrícula, la detectamos automáticamente.
              </Text>
            </View>

            {/* Selector de Grupos */}
            <View style={styles.groupContainer}>
              <View style={styles.groupHeaderRow}>
                <Text style={styles.groupHeaderTitle}>Grupos de Topografía</Text>
                <Text style={styles.groupHeaderSelected}>
                  {selectedGroup ? `Grupo ${selectedGroup}` : 'Selecciona 1 grupo'}
                </Text>
              </View>

              <View style={styles.groupGrid}>
                {TOPOGRAPHY_GROUPS.map((code) => {
                  const isSelected = selectedGroup === code;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => setSelectedGroup(code)}
                      style={[
                        styles.groupPill,
                        isSelected && styles.groupPillSelected,
                      ]}
                    >
                      <MaterialIcons
                        name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                        size={17}
                        color={isSelected ? '#fff' : theme.color.muted}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.groupPillText,
                          isSelected && styles.groupPillTextSelected,
                        ]}
                      >
                        Grupo {code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.actions}>
            <Button
              title="Confirmar grupo y comenzar"
              disabled={!selectedGroup || submitting || !!successInfo}
              loading={submitting}
              onPress={handleConfirm}
              style={styles.confirmBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '92%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    ...theme.shadow.soft,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    textAlign: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF4FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.color.navy,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: theme.font.size.sm,
    color: theme.color.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  bold: {
    color: theme.color.navy,
    fontWeight: '700',
  },
  body: {
    maxHeight: 460,
    marginTop: 8,
  },
  studentIdBox: {
    marginBottom: 14,
  },
  studentIdHint: {
    fontSize: 11,
    color: theme.color.muted,
    marginTop: 4,
    marginLeft: 2,
  },
  groupContainer: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.color.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupHeaderSelected: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.color.navy,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  groupPillSelected: {
    backgroundColor: theme.color.navy,
    borderColor: theme.color.navy,
  },
  groupPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.ink,
  },
  groupPillTextSelected: {
    color: '#fff',
  },
  actions: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    marginTop: 8,
  },
  confirmBtn: {
    width: '100%',
  },
});
