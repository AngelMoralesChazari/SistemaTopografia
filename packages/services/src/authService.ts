import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { AppUser, UserRole } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb, getFirebaseAuth } from './firebase';

function mapRole(value: unknown): UserRole | null {
  if (value === 'admin' || value === 'lab_manager' || value === 'teacher' || value === 'student') {
    return value;
  }
  return null;
}

async function loadUserProfile(user: User): Promise<AppUser> {
  let token;
  try {
    // Fuerza refresco del ID token para evitar auth/user-token-expired
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
    throw new Error(
      'Tu cuenta existe en Authentication, pero no hay perfil en Firestore (users/{uid}). Ejecuta npm run seed:users.'
    );
  }

  if (data.active === false) {
    throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
  }

  const role = mapRole(token.claims.role) ?? mapRole(data.role);
  if (!role) {
    throw new Error('El perfil no tiene un rol válido. Revisa el documento users/{uid}.');
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
    active: true,
    labId: (typeof data.labId === 'string' ? data.labId : undefined) ?? getLabId(),
  };
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return loadUserProfile(credential.user);
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
        // Si el perfil falla, cerramos sesión para no quedar a medias
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
