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
  TOPOGRAPHY_GROUPS,
  formatRole,
  isAdminRole,
  type AcademicGroup,
  type AppUser,
  type UserRole,
} from '@lab-topo/domain';
import {
  createTeacher,
  ensureDefaultGroups,
  listGroups,
  setTeacherActiveStatus,
  updateTeacher,
  watchGroups,
  watchLabUsers,
} from '@lab-topo/services';
import { Button, Notice, TextField, Toast } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { ListPagination } from '../components/ListPagination';
import { paginate } from '../lib/pagination';

type RoleFilter = 'all' | UserRole;

const ROLE_ORDER: UserRole[] = [
  'super_admin',
  'admin',
  'lab_manager',
  'teacher',
  'student',
  'renter',
];

const DISPLAY_ROLES: UserRole[] = [
  'admin',
  'lab_manager',
  'teacher',
  'student',
  'renter',
];

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Grupos académicos de Topografía desde la BD
  const [groups, setGroups] = useState<AcademicGroup[]>([]);

  // Modal Alta de Maestro
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal Edición de Maestro
  const [editingTeacher, setEditingTeacher] = useState<AppUser | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Indicador de estado de activación/desactivación en proceso
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3200);
  };

  // Carga y sincronización de usuarios en tiempo real
  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return;
    const unsub = watchLabUsers(
      (next) => {
        setUsers(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      user.labId
    );
    return unsub;
  }, [user]);

  // Carga y aseguramiento de los 16 grupos de Topografía en Firestore
  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return;
    ensureDefaultGroups(user.labId)
      .then((g) => {
        if (g.length > 0) setGroups(g);
      })
      .catch(() => {
        listGroups(user.labId).then(setGroups);
      });

    const unsub = watchGroups(
      (next) => {
        if (next.length > 0) setGroups(next);
      },
      undefined,
      user.labId
    );
    return unsub;
  }, [user]);

  const filtered = useMemo(() => {
    const list =
      roleFilter === 'all'
        ? users
        : roleFilter === 'admin'
          ? users.filter((u) => u.role === 'admin' || u.role === 'super_admin')
          : users.filter((u) => u.role === roleFilter);
    return [...list].sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(a.role);
      const rb = ROLE_ORDER.indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return a.displayName.localeCompare(b.displayName, 'es');
    });
  }, [users, roleFilter]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter]);

  const paging = useMemo(() => paginate(filtered, page), [filtered, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  const teachers = useMemo(() => users.filter((u) => u.role === 'teacher'), [users]);
  const studentsOfTeacher = useMemo(() => {
    if (!selectedTeacherId) return [];
    return users.filter((u) => u.role === 'student' && u.teacherId === selectedTeacherId);
  }, [users, selectedTeacherId]);

  const selectedTeacher = teachers.find((t) => t.uid === selectedTeacherId) ?? null;

  // Lista de códigos de grupos disponibles (de la BD o fallback a la constante oficial)
  const availableGroupCodes = useMemo(() => {
    if (groups.length > 0) {
      return groups.map((g) => g.code).sort();
    }
    return [...TOPOGRAPHY_GROUPS];
  }, [groups]);

  const toggleGroupSelection = (code: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(code) ? prev.filter((id) => id !== code) : [...prev, code].sort()
    );
  };

  const handleCreateTeacher = async () => {
    if (!user || !isAdminRole(user.role)) return;
    setCreateError(null);

    const fName = firstName.trim();
    const lName = lastName.trim();
    if (!fName || !lName) {
      setCreateError('Nombre y apellidos son campos obligatorios.');
      return;
    }

    setCreating(true);
    try {
      await createTeacher(
        {
          firstName: fName,
          lastName: lName,
          email: email.trim() || null,
          phone: phone.trim() || null,
          groupIds: selectedGroupIds,
          labId: user.labId,
        },
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        }
      );

      setShowCreateModal(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setSelectedGroupIds([]);
      showToast(`Maestro "${fName} ${lName}" registrado con éxito.`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo dar de alta al maestro.');
    } finally {
      setCreating(false);
    }
  };

  const openEditTeacher = (teacher: AppUser) => {
    setEditError(null);
    setEditingTeacher(teacher);
    const parts = teacher.displayName.trim().split(/\s+/);
    if (parts.length >= 3) {
      const mid = Math.floor(parts.length / 2);
      setEditFirstName(parts.slice(0, mid).join(' '));
      setEditLastName(parts.slice(mid).join(' '));
    } else if (parts.length === 2) {
      setEditFirstName(parts[0]);
      setEditLastName(parts[1]);
    } else {
      setEditFirstName(teacher.displayName);
      setEditLastName('');
    }
    setEditEmail(teacher.email || '');
    setEditPhone(teacher.phone || '');
    setEditGroupIds(teacher.groupIds || []);
    setEditActive(teacher.active !== false);
  };

  const toggleEditGroupSelection = (code: string) => {
    setEditGroupIds((prev) =>
      prev.includes(code) ? prev.filter((id) => id !== code) : [...prev, code].sort()
    );
  };

  const handleUpdateTeacher = async () => {
    if (!user || !isAdminRole(user.role) || !editingTeacher) return;
    setEditError(null);

    const fName = editFirstName.trim();
    const lName = editLastName.trim();
    if (!fName && !lName) {
      setEditError('Debes ingresar al menos un nombre o apellido.');
      return;
    }

    setEditSaving(true);
    try {
      await updateTeacher(
        editingTeacher.uid,
        {
          firstName: fName,
          lastName: lName,
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          groupIds: editGroupIds,
          active: editActive,
          labId: user.labId,
        },
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        }
      );

      const fullName = `${fName} ${lName}`.trim();
      showToast(`Maestro "${fullName}" actualizado con éxito.`);
      setEditingTeacher(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleActiveStatus = async (teacher: AppUser) => {
    if (!user || !isAdminRole(user.role)) return;
    const targetState = !teacher.active;
    setTogglingActiveId(teacher.uid);
    try {
      await setTeacherActiveStatus(
        teacher.uid,
        targetState,
        teacher.displayName,
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
        user.labId
      );
      showToast(
        targetState
          ? `Maestro "${teacher.displayName}" reactivado con éxito.`
          : `Maestro "${teacher.displayName}" desactivado (baja temporal).`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al cambiar estado.');
    } finally {
      setTogglingActiveId(null);
    }
  };

  const canCreateTeacher = user ? isAdminRole(user.role) : false;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Encabezado principal */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Usuarios del laboratorio</Text>
            <Text style={styles.subtitle}>
              Administradores, encargados, maestros, alumnos y particulares.
            </Text>
          </View>
          {canCreateTeacher ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
            >
              <MaterialIcons name="person-add" size={19} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Nuevo maestro</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Filtros de roles */}
        <View style={styles.filters}>
          <Pressable
            onPress={() => setRoleFilter('all')}
            style={[styles.chip, roleFilter === 'all' && styles.chipActive]}
          >
            <Text style={[styles.chipText, roleFilter === 'all' && styles.chipTextActive]}>Todos</Text>
          </Pressable>
          {DISPLAY_ROLES.map((role) => (
            <Pressable
              key={role}
              onPress={() => setRoleFilter(role)}
              style={[styles.chip, roleFilter === role && styles.chipActive]}
            >
              <Text style={[styles.chipText, roleFilter === role && styles.chipTextActive]}>
                {formatRole(role)}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Notice tone="danger" title={error} /> : null}
        {loading ? (
          <ActivityIndicator color={theme.color.navy} style={{ marginTop: 24 }} />
        ) : (
          <>
            {/* Lista de usuarios */}
            {paging.pageItems.map((u) => {
              const isTeacher = u.role === 'teacher';
              return (
                <View key={u.uid} style={[styles.card, !u.active && styles.cardInactive]}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.name}>{u.displayName}</Text>
                        {u.active ? (
                          <View style={styles.statusActiveBadge}>
                            <Text style={styles.statusActiveText}>Activo</Text>
                          </View>
                        ) : (
                          <View style={styles.statusInactiveBadge}>
                            <Text style={styles.statusInactiveText}>Desactivado</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.email}>
                        {u.email ? u.email : 'Sin correo registrado'}
                        {u.phone ? ` · Tel: ${u.phone}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.pill, isTeacher && styles.pillTeacher]}>
                      <Text style={[styles.pillText, isTeacher && styles.pillTextTeacher]}>
                        {formatRole(u.role)}
                      </Text>
                    </View>
                  </View>

                  {/* Grupos asignados al maestro */}
                  {isTeacher && u.groupIds && u.groupIds.length > 0 ? (
                    <View style={styles.assignedGroupsRow}>
                      <Text style={styles.assignedGroupsLabel}>Grupos asignados:</Text>
                      <View style={styles.assignedGroupsList}>
                        {u.groupIds.map((gid) => (
                          <View key={gid} style={styles.assignedGroupBadge}>
                            <Text style={styles.assignedGroupBadgeText}>G-{gid}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.meta}>
                      {u.active ? 'Activo' : 'Inactivo (Baja)'}
                      {u.employeeId ? ` · Empleado: ${u.employeeId}` : ''}
                      {u.studentId ? ` · Mat. ${u.studentId}` : ''}
                      {u.teacherName ? ` · Prof. ${u.teacherName}` : ''}
                      {u.renterStatus ? ` · Renta: ${u.renterStatus}` : ''}
                    </Text>

                    {/* Acciones para maestros (solo administradores) */}
                    {isTeacher && canCreateTeacher ? (
                      <View style={styles.teacherCardActions}>
                        <Pressable
                          style={styles.actionBtnSmall}
                          onPress={() => openEditTeacher(u)}
                        >
                          <MaterialIcons
                            name="edit"
                            size={14}
                            color={theme.color.navy}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.actionBtnSmallText}>Editar</Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.actionBtnSmall,
                            u.active ? styles.actionBtnDanger : styles.actionBtnSuccess,
                          ]}
                          disabled={togglingActiveId === u.uid}
                          onPress={() => handleToggleActiveStatus(u)}
                        >
                          {togglingActiveId === u.uid ? (
                            <ActivityIndicator
                              size="small"
                              color={u.active ? '#C62828' : '#2E7D32'}
                            />
                          ) : (
                            <>
                              <MaterialIcons
                                name={u.active ? 'person-off' : 'check-circle'}
                                size={14}
                                color={u.active ? '#C62828' : '#2E7D32'}
                                style={{ marginRight: 4 }}
                              />
                              <Text
                                style={[
                                  styles.actionBtnSmallText,
                                  u.active
                                    ? styles.actionBtnDangerText
                                    : styles.actionBtnSuccessText,
                                ]}
                              >
                                {u.active ? 'Desactivar' : 'Reactivar'}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
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

            {/* Sección Maestros y sus alumnos */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sectionTitle}>Maestros y sus alumnos</Text>
                <Text style={styles.subtitle}>
                  Selecciona un maestro para ver sus grupos asignados y sus alumnos.
                </Text>
              </View>
            </View>

            <View style={styles.filters}>
              {teachers.length === 0 ? (
                <Text style={styles.empty}>No hay maestros registrados aún.</Text>
              ) : (
                teachers.map((t) => (
                  <Pressable
                    key={t.uid}
                    onPress={() => setSelectedTeacherId(t.uid)}
                    style={[
                      styles.chip,
                      selectedTeacherId === t.uid && styles.chipActive,
                      !t.active && styles.chipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedTeacherId === t.uid && styles.chipTextActive,
                        !t.active && styles.chipTextInactive,
                      ]}
                    >
                      {t.displayName}
                      {!t.active ? ' [Inactivo]' : ''}
                      {t.groupIds && t.groupIds.length > 0 ? ` (${t.groupIds.join(', ')})` : ''}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            {selectedTeacher ? (
              <View style={[styles.card, !selectedTeacher.active && styles.cardInactive]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={styles.name}>{selectedTeacher.displayName}</Text>
                      {selectedTeacher.active ? (
                        <View style={styles.statusActiveBadge}>
                          <Text style={styles.statusActiveText}>Activo</Text>
                        </View>
                      ) : (
                        <View style={styles.statusInactiveBadge}>
                          <Text style={styles.statusInactiveText}>Desactivado</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.email}>
                      {selectedTeacher.email || 'Sin correo registrado'}
                      {selectedTeacher.phone ? ` · Tel: ${selectedTeacher.phone}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.pill, styles.pillTeacher]}>
                    <Text style={[styles.pillText, styles.pillTextTeacher]}>Docente</Text>
                  </View>
                </View>

                {/* Acciones de administración para el maestro seleccionado */}
                {canCreateTeacher ? (
                  <View style={[styles.teacherCardActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                    <Pressable
                      style={styles.actionBtnSmall}
                      onPress={() => openEditTeacher(selectedTeacher)}
                    >
                      <MaterialIcons
                        name="edit"
                        size={14}
                        color={theme.color.navy}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.actionBtnSmallText}>Editar datos y grupos</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.actionBtnSmall,
                        selectedTeacher.active
                          ? styles.actionBtnDanger
                          : styles.actionBtnSuccess,
                      ]}
                      disabled={togglingActiveId === selectedTeacher.uid}
                      onPress={() => handleToggleActiveStatus(selectedTeacher)}
                    >
                      {togglingActiveId === selectedTeacher.uid ? (
                        <ActivityIndicator
                          size="small"
                          color={selectedTeacher.active ? '#C62828' : '#2E7D32'}
                        />
                      ) : (
                        <>
                          <MaterialIcons
                            name={selectedTeacher.active ? 'person-off' : 'check-circle'}
                            size={14}
                            color={selectedTeacher.active ? '#C62828' : '#2E7D32'}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.actionBtnSmallText,
                              selectedTeacher.active
                                ? styles.actionBtnDangerText
                                : styles.actionBtnSuccessText,
                            ]}
                          >
                            {selectedTeacher.active ? 'Desactivar maestro' : 'Reactivar maestro'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {selectedTeacher.groupIds && selectedTeacher.groupIds.length > 0 ? (
                  <View style={[styles.assignedGroupsRow, { marginTop: 12 }]}>
                    <Text style={styles.assignedGroupsLabel}>Grupos a su cargo:</Text>
                    <View style={styles.assignedGroupsList}>
                      {selectedTeacher.groupIds.map((gid) => (
                        <View key={gid} style={styles.assignedGroupBadge}>
                          <Text style={styles.assignedGroupBadgeText}>Grupo {gid}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.meta, { marginTop: 6, fontStyle: 'italic' }]}>
                    Sin grupos asignados actualmente.
                  </Text>
                )}

                <Text style={[styles.meta, { marginTop: 12, fontWeight: '700', color: theme.color.navy }]}>
                  {studentsOfTeacher.length} alumno(s) asignado(s):
                </Text>
                {studentsOfTeacher.length === 0 ? (
                  <Text style={styles.empty}>Sin alumnos vinculados directamente.</Text>
                ) : (
                  studentsOfTeacher.map((s) => (
                    <View key={s.uid} style={styles.studentRow}>
                      <Text style={styles.studentName}>{s.displayName}</Text>
                      <Text style={styles.studentMeta}>
                        {s.studentId ? `Mat. ${s.studentId}` : '—'} · {s.email}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Pop-up Modal: Alta de nuevo maestro */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!creating) setShowCreateModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Alta de nuevo maestro</Text>
                <Text style={styles.modalSub}>
                  Registra un docente en el laboratorio y asígnale los grupos de Topografía a su cargo.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!creating) setShowCreateModal(false);
                }}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color={theme.color.muted} />
              </Pressable>
            </View>

            {createError ? <Notice tone="danger" title={createError} /> : null}

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Datos personales */}
              <View style={styles.formGrid}>
                <TextField
                  label="Nombre(s) *"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Ej: Carlos Alberto"
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Apellidos *"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Ej: Hernández Morales"
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Correo electrónico (opcional)"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="profesor@uagro.mx"
                  keyboardType="email-address"
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Número de teléfono (opcional)"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Ej: 747 123 4567"
                  keyboardType="phone-pad"
                  containerStyle={styles.formField}
                />
              </View>

              {/* Selector de Grupos asignados */}
              <View style={styles.groupSection}>
                <View style={styles.groupSectionHeader}>
                  <Text style={styles.groupSectionTitle}>Grupos asignados (Topografía)</Text>
                  <Text style={styles.groupSectionCount}>
                    {selectedGroupIds.length === 0
                      ? 'Ningún grupo seleccionado'
                      : `${selectedGroupIds.length} grupo(s) seleccionado(s)`}
                  </Text>
                </View>
                <Text style={styles.groupSectionHint}>
                  Selecciona uno o más grupos que impartirá este maestro. Los alumnos de estos grupos
                  estarán bajo su supervisión para solicitar material.
                </Text>

                <View style={styles.groupGrid}>
                  {availableGroupCodes.map((code) => {
                    const isSelected = selectedGroupIds.includes(code);
                    return (
                      <Pressable
                        key={code}
                        onPress={() => toggleGroupSelection(code)}
                        style={[
                          styles.groupPill,
                          isSelected && styles.groupPillActive,
                        ]}
                      >
                        <MaterialIcons
                          name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                          size={16}
                          color={isSelected ? '#fff' : theme.color.muted}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.groupPillText,
                            isSelected && styles.groupPillTextActive,
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

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Button
                title="Registrar maestro"
                loading={creating}
                onPress={handleCreateTeacher}
                style={styles.modalSaveBtn}
              />
              <Button
                title="Cancelar"
                variant="secondary"
                disabled={creating}
                onPress={() => setShowCreateModal(false)}
                fullWidth={false}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Pop-up Modal: Editar datos del maestro */}
      <Modal
        visible={editingTeacher !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!editSaving) setEditingTeacher(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Editar maestro</Text>
                <Text style={styles.modalSub}>
                  Modifica la información del docente, su estado o los grupos de Topografía asignados.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!editSaving) setEditingTeacher(null);
                }}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color={theme.color.muted} />
              </Pressable>
            </View>

            {editError ? <Notice tone="danger" title={editError} /> : null}

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Datos personales */}
              <View style={styles.formGrid}>
                <TextField
                  label="Nombre(s) *"
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder="Ej: Carlos Alberto"
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Apellidos *"
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder="Ej: Hernández Morales"
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Correo electrónico (opcional)"
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="profesor@uagro.mx"
                  keyboardType="email-address"
                  containerStyle={styles.formField}
                />
                <TextField
                  label="Número de teléfono (opcional)"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Ej: 747 123 4567"
                  keyboardType="phone-pad"
                  containerStyle={styles.formField}
                />
              </View>

              {/* Estado de activación en el laboratorio (Baja lógica / Activo) */}
              <View style={styles.statusToggleContainer}>
                <Text style={styles.statusToggleLabel}>Estado en el laboratorio</Text>
                <View style={styles.statusToggleRow}>
                  <Pressable
                    onPress={() => setEditActive(true)}
                    style={[
                      styles.statusToggleOption,
                      editActive && styles.statusToggleOptionActive,
                    ]}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={18}
                      color={editActive ? '#2E7D32' : theme.color.muted}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.statusToggleOptionText,
                          editActive && styles.statusToggleOptionTextActive,
                        ]}
                      >
                        Activo
                      </Text>
                      <Text style={styles.statusToggleOptionSub}>Habilitado para prácticas</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => setEditActive(false)}
                    style={[
                      styles.statusToggleOption,
                      !editActive && styles.statusToggleOptionInactive,
                    ]}
                  >
                    <MaterialIcons
                      name="person-off"
                      size={18}
                      color={!editActive ? '#C62828' : theme.color.muted}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.statusToggleOptionText,
                          !editActive && styles.statusToggleOptionTextInactive,
                        ]}
                      >
                        Desactivado
                      </Text>
                      <Text style={styles.statusToggleOptionSub}>Baja temporal / En pausa</Text>
                    </View>
                  </Pressable>
                </View>
                <Text style={styles.statusToggleHint}>
                  {editActive
                    ? 'El maestro aparecerá disponible en el catálogo de profesores para los alumnos.'
                    : 'El maestro no estará disponible para nuevos alumnos, pero conservará su historial y datos intactos.'}
                </Text>
              </View>

              {/* Selector de Grupos asignados */}
              <View style={styles.groupSection}>
                <View style={styles.groupSectionHeader}>
                  <Text style={styles.groupSectionTitle}>Grupos asignados (Topografía)</Text>
                  <Text style={styles.groupSectionCount}>
                    {editGroupIds.length === 0
                      ? 'Ningún grupo seleccionado'
                      : `${editGroupIds.length} grupo(s) asignado(s)`}
                  </Text>
                </View>
                <Text style={styles.groupSectionHint}>
                  Selecciona los grupos que tiene a cargo este maestro. Puedes agregar nuevos grupos o retirar los que ya no imparta.
                </Text>

                <View style={styles.groupGrid}>
                  {availableGroupCodes.map((code) => {
                    const isSelected = editGroupIds.includes(code);
                    return (
                      <Pressable
                        key={code}
                        onPress={() => toggleEditGroupSelection(code)}
                        style={[
                          styles.groupPill,
                          isSelected && styles.groupPillActive,
                        ]}
                      >
                        <MaterialIcons
                          name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                          size={16}
                          color={isSelected ? '#fff' : theme.color.muted}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.groupPillText,
                            isSelected && styles.groupPillTextActive,
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

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Button
                title="Guardar cambios"
                loading={editSaving}
                onPress={handleUpdateTeacher}
                style={styles.modalSaveBtn}
              />
              <Button
                title="Cancelar"
                variant="secondary"
                disabled={editSaving}
                onPress={() => setEditingTeacher(null)}
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
    marginBottom: 16,
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
    marginBottom: 14,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.navy,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    ...theme.shadow.soft,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.xl,
    fontWeight: '800',
  },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  chipActive: { backgroundColor: theme.color.infoSoft, borderColor: theme.color.navy },
  chipInactive: { opacity: 0.65, backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  chipText: { color: theme.color.muted, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: theme.color.navy },
  chipTextInactive: { color: '#64748B' },

  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.soft,
  },
  cardInactive: {
    opacity: 0.85,
    backgroundColor: '#FAFBFD',
    borderColor: '#E2E8F0',
  },
  statusActiveBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  statusActiveText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '800',
  },
  statusInactiveBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  statusInactiveText: {
    color: '#C62828',
    fontSize: 10,
    fontWeight: '800',
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  name: { color: theme.color.navy, fontWeight: '800', fontSize: theme.font.size.md },
  email: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.color.infoSoft,
  },
  pillTeacher: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  pillText: { color: theme.color.navy, fontSize: 10, fontWeight: '800' },
  pillTextTeacher: { color: '#2E7D32' },

  assignedGroupsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F6',
  },
  assignedGroupsLabel: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: '700',
    marginRight: 2,
  },
  assignedGroupsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  assignedGroupBadge: {
    backgroundColor: '#EEF4FB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D4E2F2',
  },
  assignedGroupBadgeText: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },

  meta: { marginTop: 8, color: theme.color.muted, fontSize: 12 },
  empty: { marginTop: 8, color: theme.color.muted, fontSize: 12 },
  studentRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  studentName: { color: theme.color.ink, fontWeight: '700' },
  studentMeta: { color: theme.color.muted, fontSize: 12, marginTop: 2 },

  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  teacherCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D0D9E4',
  },
  actionBtnSmallText: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  actionBtnDanger: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  actionBtnDangerText: {
    color: '#C62828',
  },
  actionBtnSuccess: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  actionBtnSuccessText: {
    color: '#2E7D32',
  },

  statusToggleContainer: {
    marginTop: 4,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusToggleLabel: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  statusToggleOption: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  statusToggleOptionActive: {
    borderColor: '#2E7D32',
    backgroundColor: '#F1F8F3',
  },
  statusToggleOptionInactive: {
    borderColor: '#C62828',
    backgroundColor: '#FFF5F5',
  },
  statusToggleOptionText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.color.ink,
  },
  statusToggleOptionTextActive: {
    color: '#2E7D32',
  },
  statusToggleOptionTextInactive: {
    color: '#C62828',
  },
  statusToggleOptionSub: {
    fontSize: 10,
    color: theme.color.muted,
    marginTop: 1,
  },
  statusToggleHint: {
    color: theme.color.muted,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
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

  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  formField: {
    flexGrow: 1,
    flexBasis: 260,
  },

  groupSection: {
    marginTop: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  groupSectionTitle: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupSectionCount: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  groupSectionHint: {
    color: theme.color.muted,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
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
  groupPillActive: {
    backgroundColor: theme.color.navy,
    borderColor: theme.color.navy,
  },
  groupPillText: {
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  groupPillTextActive: {
    color: '#fff',
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
    marginTop: 10,
  },
  modalSaveBtn: {
    flex: 1,
  },
});
