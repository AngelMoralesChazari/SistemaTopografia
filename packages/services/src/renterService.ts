import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AppUser, RenterStatus } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb, getFirebaseAuth } from './firebase';

export type RegisterRenterInput = {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  company: string;
  ine: string;
  rfc: string;
  address: string;
};

function mapRenterDoc(id: string, data: Record<string, unknown>): AppUser {
  return {
    uid: id,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? 'Particular'),
    role: 'renter',
    studentId: null,
    employeeId: null,
    teacherId: null,
    teacherName: null,
    groupIds: [],
    active: data.active !== false,
    labId: String(data.labId ?? getLabId()),
    renterStatus: (data.renterStatus as RenterStatus | null) ?? 'pending',
    phone: (data.phone as string | null) ?? null,
    company: (data.company as string | null) ?? null,
    ine: (data.ine as string | null) ?? null,
    rfc: (data.rfc as string | null) ?? null,
    address: (data.address as string | null) ?? null,
  };
}

export async function registerRenter(input: RegisterRenterInput): Promise<AppUser> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const phone = input.phone.trim();
  const company = input.company.trim();
  const ine = input.ine.trim();
  const rfc = input.rfc.trim().toUpperCase();
  const address = input.address.trim();

  if (!email || !input.password || !displayName) {
    throw new Error('Completa nombre, correo y contraseña.');
  }
  if (input.password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  if (!phone || !company || !ine || !rfc || !address) {
    throw new Error('Completa teléfono, empresa, INE, RFC y dirección.');
  }

  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, input.password);
  const uid = credential.user.uid;

  try {
    await updateProfile(credential.user, { displayName });
  } catch {
    // no bloqueante
  }

  const labId = getLabId();
  const profile = {
    email,
    displayName,
    role: 'renter' as const,
    labId,
    active: false,
    renterStatus: 'pending' as const,
    phone,
    company,
    ine,
    rfc,
    address,
    studentId: null,
    employeeId: null,
    teacherId: null,
    teacherName: null,
    groupIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(getDb(), 'users', uid), profile);

  return {
    uid,
    email,
    displayName,
    role: 'renter',
    active: false,
    labId,
    renterStatus: 'pending',
    phone,
    company,
    ine,
    rfc,
    address,
    studentId: null,
    employeeId: null,
    groupIds: [],
  };
}

export function watchPendingRenters(
  onChange: (users: AppUser[]) => void,
  onError?: (error: Error) => void,
  labId = getLabId()
): Unsubscribe {
  const q = query(
    collection(getDb(), 'users'),
    where('labId', '==', labId),
    where('role', '==', 'renter'),
    where('renterStatus', '==', 'pending')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapRenterDoc(d.id, d.data()))),
    (error) => onError?.(error)
  );
}

export function watchRenters(
  onChange: (users: AppUser[]) => void,
  onError?: (error: Error) => void,
  labId = getLabId()
): Unsubscribe {
  const q = query(
    collection(getDb(), 'users'),
    where('labId', '==', labId),
    where('role', '==', 'renter')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => mapRenterDoc(d.id, d.data()))),
    (error) => onError?.(error)
  );
}

export async function setRenterStatus(
  userId: string,
  status: Extract<RenterStatus, 'approved' | 'rejected'>
): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId), {
    renterStatus: status,
    active: status === 'approved',
    updatedAt: serverTimestamp(),
  });
}
