import React, { useEffect, useState } from 'react';
import {
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
              <MaterialIcons name="school" size={26} color={theme.color.navy} />
            </View>
            <Text style={styles.title}>¡Bienvenido(a)!</Text>
            <Text style={styles.subtitle}>
              Hola, <Text style={styles.bold}>{user.displayName}</Text>. Selecciona tu grupo
              académico para solicitar material de laboratorio:
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
            </View>

            {/* Selector de Grupos */}
            <View style={styles.groupContainer}>
              <View style={styles.groupHeaderRow}>
                <Text style={styles.groupHeaderTitle}>Grupos de Topografía</Text>
                <Text style={styles.groupHeaderSelected}>
                  {selectedGroup ? `Grupo ${selectedGroup}` : 'Elige 1'}
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
                        size={16}
                        color={isSelected ? '#fff' : theme.color.muted}
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={[
                          styles.groupPillText,
                          isSelected && styles.groupPillTextSelected,
                        ]}
                      >
                        G-{code}
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
              title="Confirmar grupo y entrar"
              disabled={!selectedGroup || submitting || !!successInfo}
              loading={submitting}
              onPress={handleConfirm}
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxHeight: '94%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    ...theme.shadow.soft,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF4FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.color.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: theme.color.muted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  bold: {
    color: theme.color.navy,
    fontWeight: '700',
  },
  body: {
    maxHeight: 380,
    marginTop: 4,
  },
  studentIdBox: {
    marginBottom: 10,
  },
  groupContainer: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.color.navy,
    textTransform: 'uppercase',
  },
  groupHeaderSelected: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.color.navy,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  groupPillSelected: {
    backgroundColor: theme.color.navy,
    borderColor: theme.color.navy,
  },
  groupPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.ink,
  },
  groupPillTextSelected: {
    color: '#fff',
  },
  actions: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    marginTop: 6,
  },
});
