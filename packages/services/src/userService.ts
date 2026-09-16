import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AppUser, RenterStatus, UserRole } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb } from './firebase';
import { writeAuditLog } from './auditService';

function mapUser(id: string, data: Record<string, unknown>, labId: string): AppUser {
  return {
    uid: id,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? 'Usuario'),
    role: (data.role as UserRole) ?? 'student',
    studentId: (data.studentId as string | null) ?? null,
    employeeId: (data.employeeId as string | null) ?? null,
    teacherId: (data.teacherId as string | null) ?? null,
    teacherName: (data.teacherName as string | null) ?? null,
    groupIds: (data.groupIds as string[]) ?? [],
    active: data.active !== false,
    labId: String(data.labId ?? labId),
    renterStatus: (data.renterStatus as RenterStatus | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    company: (data.company as string | null) ?? null,
    ine: (data.ine as string | null) ?? null,
    rfc: (data.rfc as string | null) ?? null,
    address: (data.address as string | null) ?? null,
  };
}

export async function listTeachers(labId = getLabId()): Promise<AppUser[]> {
  const q = query(
    collection(getDb(), 'users'),
    where('labId', '==', labId),
    where('role', '==', 'teacher'),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapUser(d.id, d.data(), labId));
}

/** Todos los usuarios del laboratorio (admin). */
export function watchLabUsers(
  onChange: (users: AppUser[]) => void,
  onError?: (error: Error) => void,
  labId = getLabId()
): Unsubscribe {
  const q = query(collection(getDb(), 'users'), where('labId', '==', labId));
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map((d) => mapUser(d.id, d.data(), labId))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
      onChange(users);
    },
    (error) => onError?.(error)
  );
}

export type CreateTeacherInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  groupIds: string[];
  employeeId?: string | null;
  labId?: string;
};

/** Crea un nuevo maestro en Firestore y registra el evento en auditoría */
export async function createTeacher(
  input: CreateTeacherInput,
  actor?: { uid: string; email?: string | null; displayName?: string | null; role?: UserRole }
): Promise<string> {
  const labId = input.labId || getLabId();
  const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  const db = getDb();
  const userRef = doc(collection(db, 'users'));
  const uid = userRef.id;

  const data = {
    uid,
    displayName,
    email: input.email?.trim().toLowerCase() || '',
    phone: input.phone?.trim() || null,
    role: 'teacher' as UserRole,
    groupIds: input.groupIds ?? [],
    employeeId: input.employeeId?.trim() || null,
    studentId: null,
    teacherId: null,
    teacherName: null,
    active: true,
    labId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, data);

  if (actor) {
    try {
      await writeAuditLog({
        labId,
        actorId: actor.uid,
        actorEmail: actor.email ?? '',
        actorName: actor.displayName ?? 'Administrador',
        actorRole: actor.role ?? 'admin',
        action: 'USER_CREATE',
        targetType: 'user',
        targetId: uid,
        summary: `Alta de maestro: ${displayName} (${(input.groupIds ?? []).length} grupos asignados: ${(input.groupIds ?? []).join(', ') || 'ninguno'})`,
      });
    } catch {
      // Ignorar fallo de auditoría secundaria
    }
  }

  // Vincular alumnos pendientes que ya pertenezcan a los grupos asignados al maestro
  if ((input.groupIds ?? []).length > 0) {
    try {
      await syncPendingStudentsForTeacher(uid, displayName, input.groupIds ?? [], labId);
    } catch {
      // Ignorar fallo no crítico de sincronización
    }
  }

  return uid;
}

export type UpdateTeacherInput = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string | null;
  phone?: string | null;
  groupIds?: string[];
  employeeId?: string | null;
  active?: boolean;
  labId?: string;
};

/** Actualiza los datos de un maestro existente en Firestore */
export async function updateTeacher(
  teacherId: string,
  input: UpdateTeacherInput,
  actor?: { uid: string; email?: string | null; displayName?: string | null; role?: UserRole }
): Promise<void> {
  const labId = input.labId || getLabId();
  const db = getDb();
  const userRef = doc(db, 'users', teacherId);

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.firstName !== undefined || input.lastName !== undefined) {
    const parts = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean);
    if (parts.length > 0) {
      updateData.displayName = parts.join(' ');
    }
  } else if (input.displayName !== undefined) {
    updateData.displayName = input.displayName.trim();
  }

  if (input.email !== undefined) {
    updateData.email = input.email ? input.email.trim().toLowerCase() : '';
  }

  if (input.phone !== undefined) {
    updateData.phone = input.phone ? input.phone.trim() : null;
  }

  if (input.groupIds !== undefined) {
    updateData.groupIds = input.groupIds;
  }

  if (input.employeeId !== undefined) {
    updateData.employeeId = input.employeeId ? input.employeeId.trim() : null;
  }

  if (input.active !== undefined) {
    updateData.active = input.active;
  }

  await updateDoc(userRef, updateData);

  // Si se actualizaron grupos o el maestro está activo, sincronizar alumnos pendientes
  const groupsToSync = input.groupIds;
  if (groupsToSync && groupsToSync.length > 0 && input.active !== false) {
    const teacherDisplayName =
      (updateData.displayName as string) || input.displayName || 'Maestro';
    try {
      await syncPendingStudentsForTeacher(teacherId, teacherDisplayName, groupsToSync, labId);
    } catch {
      // Ignorar fallo no crítico de sincronización
    }
  }

  if (actor) {
    try {
      const summaryParts: string[] = [];
      if (updateData.displayName) summaryParts.push(`Nombre: ${updateData.displayName}`);
      if (input.groupIds) summaryParts.push(`Grupos: ${input.groupIds.join(', ') || 'ninguno'}`);
      if (input.active !== undefined) summaryParts.push(`Estado: ${input.active ? 'Activo' : 'Inactivo'}`);

      await writeAuditLog({
        labId,
        actorId: actor.uid,
        actorEmail: actor.email ?? '',
        actorName: actor.displayName ?? 'Administrador',
        actorRole: actor.role ?? 'admin',
        action: 'USER_UPDATE',
        targetType: 'user',
        targetId: teacherId,
        summary: `Edición de maestro (${teacherId}): ${summaryParts.join(' | ') || 'Actualización de perfil'}`,
      });
    } catch {
      // Ignorar fallo de auditoría secundaria
    }
  }
}

/** Cambia el estado de activación de un maestro (baja lógica / reactivación) */
export async function setTeacherActiveStatus(
  teacherId: string,
  active: boolean,
  teacherName?: string,
  actor?: { uid: string; email?: string | null; displayName?: string | null; role?: UserRole },
  labId = getLabId()
): Promise<void> {
  const db = getDb();
  const userRef = doc(db, 'users', teacherId);

  await updateDoc(userRef, {
    active,
    updatedAt: serverTimestamp(),
  });

  if (actor) {
    try {
      await writeAuditLog({
        labId,
        actorId: actor.uid,
        actorEmail: actor.email ?? '',
        actorName: actor.displayName ?? 'Administrador',
        actorRole: actor.role ?? 'admin',
        action: 'USER_UPDATE',
        targetType: 'user',
        targetId: teacherId,
        summary: `${active ? 'Reactivación' : 'Desactivación (baja)'} de maestro: ${teacherName || teacherId}`,
      });
    } catch {
      // Ignorar fallo de auditoría secundaria
    }
  }
}

export type AssignStudentGroupResult = {
  teacherId: string | null;
  teacherName: string;
  groupCode: string;
};

/**
 * Asigna el grupo de Topografía al alumno y busca automáticamente en Firestore
 * al docente activo que tenga a cargo dicho grupo para vincularlos.
 */
export async function assignStudentAcademicGroup(
  studentUid: string,
  groupCode: string,
  studentId?: string | null,
  actor?: { uid: string; email?: string | null; displayName?: string | null; role?: UserRole },
  labId = getLabId()
): Promise<AssignStudentGroupResult> {
  const db = getDb();

  // 1. Buscar maestros activos del laboratorio
  const q = query(
    collection(db, 'users'),
    where('labId', '==', labId),
    where('role', '==', 'teacher'),
    where('active', '==', true)
  );
  const snap = await getDocs(q);

  let assignedTeacherId: string | null = null;
  let assignedTeacherName = 'Pendiente de asignación';

  for (const d of snap.docs) {
    const data = d.data();
    const groupIds: string[] = (data.groupIds as string[]) || [];
    if (groupIds.includes(groupCode)) {
      assignedTeacherId = d.id;
      assignedTeacherName = String(data.displayName || 'Maestro');
      break;
    }
  }

  // 2. Actualizar documento del alumno
  const studentRef = doc(db, 'users', studentUid);
  const updateData: Record<string, unknown> = {
    groupIds: [groupCode],
    teacherId: assignedTeacherId,
    teacherName: assignedTeacherName,
    updatedAt: serverTimestamp(),
  };

  if (studentId && studentId.trim()) {
    updateData.studentId = studentId.trim();
  }

  await updateDoc(studentRef, updateData);

  // 3. Auditoría
  if (actor) {
    try {
      await writeAuditLog({
        labId,
        actorId: actor.uid,
        actorEmail: actor.email ?? '',
        actorName: actor.displayName ?? 'Alumno',
        actorRole: actor.role ?? 'student',
        action: 'USER_UPDATE',
        targetType: 'user',
        targetId: studentUid,
        summary: `Alumno asignó grupo ${groupCode} (Maestro: ${assignedTeacherName})`,
      });
    } catch {
      // Ignorar fallo de auditoría secundaria
    }
  }

  return {
    teacherId: assignedTeacherId,
    teacherName: assignedTeacherName,
    groupCode,
  };
}

/**
  * Sincroniza y vincula a alumnos que estén con "Pendiente de asignación"
  * y cuyo grupo coincida con los grupos recién asignados a un maestro.
  */
export async function syncPendingStudentsForTeacher(
  teacherId: string,
  teacherDisplayName: string,
  groupIds: string[],
  labId = getLabId()
): Promise<number> {
  if (!groupIds || groupIds.length === 0) return 0;
  const db = getDb();
  try {
    const q = query(
      collection(db, 'users'),
      where('labId', '==', labId),
      where('role', '==', 'student')
    );
    const snap = await getDocs(q);
    let updatedCount = 0;

    for (const d of snap.docs) {
      const data = d.data();
      const currentTeacherId = data.teacherId;
      const currentTeacherName = data.teacherName;
      const studentGroups: string[] = (data.groupIds as string[]) || [];

      // Si el alumno no tiene maestro o está marcado como 'Pendiente de asignación'
      const isPending =
        !currentTeacherId ||
        currentTeacherName === 'Pendiente de asignación' ||
        currentTeacherName === null;

      if (isPending) {
        const matchesGroup = studentGroups.some((g) => groupIds.includes(g));
        if (matchesGroup) {
          await updateDoc(doc(db, 'users', d.id), {
            teacherId,
            teacherName: teacherDisplayName,
            updatedAt: serverTimestamp(),
          });
          updatedCount++;
        }
      }
    }
    return updatedCount;
  } catch {
    return 0;
  }
}

