import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { AppUser, RenterStatus, UserRole } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb, getFirebaseAuth } from './firebase';

function mapRole(value: unknown): UserRole | null {
  if (
    value === 'super_admin' ||
    value === 'admin' ||
    value === 'lab_manager' ||
    value === 'teacher' ||
    value === 'student' ||
    value === 'renter'
  ) {
    return value;
  }
  return null;
}

function mapRenterStatus(value: unknown): RenterStatus | null {
  if (value === 'pending' || value === 'approved' || value === 'rejected') {
    return value;
  }
  return null;
}

/** Correos institucionales @uagro.mx excluidos de asignación automática de rol alumno */
export const EXCEPTION_STAFF_EMAILS = [
  '19258@uagro.mx',
  '17651@uagro.mx'
];

/** Determina si un correo pertenece al dominio institucional @uagro.mx */
export function isUagroEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@uagro.mx');
}

/** Extrae la matrícula del correo institucional si inicia con dígitos (ej: 24722899@uagro.mx -> 24722899) */
export function extractStudentIdFromEmail(email: string): string | null {
  const localPart = email.split('@')[0]?.trim() || '';
  if (/^\d{5,12}$/.test(localPart)) {
    return localPart;
  }
  return null;
}

async function loadUserProfile(user: User): Promise<AppUser> {
  let token;
  try {
    token = await user.getIdTokenResult(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('auth/user-token-expired') || message.includes('auth/id-token-expired')) {
      throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    }
    throw error instanceof Error ? error : new Error(message);
  }

  let data: Record<string, unknown> | undefined;
  let snapExists = false;

  try {
    const snap = await getDoc(doc(getDb(), 'users', user.uid));
    snapExists = snap.exists();
    data = snap.data();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al leer perfil';
    if (message.includes('auth/user-token-expired') || message.includes('auth/id-token-expired')) {
      throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    }
    throw new Error(
      `No se pudo leer el perfil en Firestore. ¿Publicaste las reglas? Detalle: ${message}`
    );
  }

  if (!snapExists || !data) {
    const email = (user.email ?? '').trim().toLowerCase();
    if (isUagroEmail(email) && !EXCEPTION_STAFF_EMAILS.includes(email)) {
      const studentData = {
        uid: user.uid,
        email,
        displayName: user.displayName || 'Alumno',
        role: 'student' as UserRole,
        studentId: extractStudentIdFromEmail(email),
        employeeId: null,
        teacherId: null,
        teacherName: 'Pendiente de asignación',
        groupIds: [],
        active: true,
        labId: getLabId(),
        renterStatus: null,
        phone: user.phoneNumber ?? null,
        company: null,
        ine: null,
        rfc: null,
        address: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(getDb(), 'users', user.uid), studentData);
      data = studentData as Record<string, unknown>;
      snapExists = true;
    } else {
      throw new Error(
        'Tu cuenta existe en Authentication, pero no hay perfil en Firestore (users/{uid}).'
      );
    }
  }

  const role = mapRole(token.claims.role) ?? mapRole(data.role);
  if (!role) {
    throw new Error('El perfil no tiene un rol válido. Revisa el documento users/{uid}.');
  }

  const renterStatus = mapRenterStatus(data.renterStatus);
  const isActive = data.active !== false;

  if (!isActive) {
    if (role === 'renter' && (renterStatus === 'pending' || renterStatus === 'rejected')) {
      // Permite entrar para ver el estado de aprobación.
    } else {
      throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
    }
  }

  if (role === 'renter' && renterStatus === 'approved' && !isActive) {
    throw new Error('Tu cuenta está desactivada. Contacta al laboratorio.');
  }

  return {
    uid: user.uid,
    email: user.email ?? (typeof data.email === 'string' ? data.email : ''),
    displayName:
      (typeof data.displayName === 'string' ? data.displayName : undefined) ??
      user.displayName ??
      user.email ??
      'Usuario',
    role,
    studentId: (data.studentId as string | null | undefined) ?? null,
    employeeId: (data.employeeId as string | null | undefined) ?? null,
    teacherId: (data.teacherId as string | null | undefined) ?? null,
    teacherName: (data.teacherName as string | null | undefined) ?? null,
    groupIds: (data.groupIds as string[] | undefined) ?? [],
    active: isActive,
    labId: (typeof data.labId === 'string' ? data.labId : undefined) ?? getLabId(),
    renterStatus: role === 'renter' ? (renterStatus ?? 'pending') : null,
    phone: (data.phone as string | null | undefined) ?? null,
    company: (data.company as string | null | undefined) ?? null,
    ine: (data.ine as string | null | undefined) ?? null,
    rfc: (data.rfc as string | null | undefined) ?? null,
    address: (data.address as string | null | undefined) ?? null,
  };
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return loadUserProfile(credential.user);
}

/** Iniciar sesión con Google (Web popup o idToken para móvil) */
export async function signInWithGoogle(idToken?: string): Promise<AppUser> {
  const auth = getFirebaseAuth();

  let user: User;
  if (idToken) {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    user = result.user;
  } else {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      hd: 'uagro.mx',
    });
    const result = await signInWithPopup(auth, provider);
    user = result.user;
  }

  const email = (user.email ?? '').trim().toLowerCase();

  // Verificar si ya existe el perfil en Firestore
  const userRef = doc(getDb(), 'users', user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // Si no existe, verificar si es correo @uagro.mx válido
    if (!isUagroEmail(email)) {
      await firebaseSignOut(auth);
      throw new Error(
        'Acceso restringido: Solo se permite el registro de alumnos con correo institucional @uagro.mx.'
      );
    }

    if (EXCEPTION_STAFF_EMAILS.includes(email)) {
      await firebaseSignOut(auth);
      throw new Error(
        `La cuenta ${email} es una cuenta especial y requiere que el administrador configure su rol previamente.`
      );
    }

    // Auto-crear como alumno
    const newStudentData = {
      uid: user.uid,
      email,
      displayName: user.displayName || 'Alumno',
      role: 'student' as UserRole,
      studentId: extractStudentIdFromEmail(email),
      employeeId: null,
      teacherId: null,
      teacherName: 'Pendiente de asignación',
      groupIds: [],
      active: true,
      labId: getLabId(),
      renterStatus: null,
      phone: user.phoneNumber ?? null,
      company: null,
      ine: null,
      rfc: null,
      address: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, newStudentData);
  }

  return loadUserProfile(user);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export function watchAuth(
  onChange: (user: AppUser | null) => void,
  onError?: (error: Error) => void
): () => void {
  return onAuthStateChanged(
    getFirebaseAuth(),
    async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          onChange(null);
          return;
        }
        const profile = await loadUserProfile(firebaseUser);
        onChange(profile);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Error de sesión'));
        try {
          await firebaseSignOut(getFirebaseAuth());
        } catch {
          // ignore
        }
        onChange(null);
      }
    },
    (error) => onError?.(error)
  );
}

/** Recarga el perfil del usuario autenticado (p. ej. tras aprobación). */
export async function refreshCurrentUser(): Promise<AppUser | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return loadUserProfile(user);
}
