import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { UserRole } from '@lab-topo/domain';
import { getLabId } from '@lab-topo/config';
import { getDb } from './firebase';

export type AuditLogEntry = {
  id: string;
  labId: string;
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  before: string | null;
  after: string | null;
  createdAt: string | null;
};

export type WriteAuditInput = {
  labId?: string;
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  before?: string | null;
  after?: string | null;
};

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  await addDoc(collection(getDb(), 'auditLogs'), {
    labId: input.labId || getLabId(),
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    before: input.before ?? null,
    after: input.after ?? null,
    createdAt: serverTimestamp(),
  });
}

export function watchAuditLogs(
  onChange: (entries: AuditLogEntry[]) => void,
  onError?: (error: Error) => void,
  labId = getLabId()
): Unsubscribe {
  const q = query(
    collection(getDb(), 'auditLogs'),
    where('labId', '==', labId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            labId: String(data.labId ?? labId),
            actorId: String(data.actorId ?? ''),
            actorEmail: String(data.actorEmail ?? ''),
            actorName: String(data.actorName ?? ''),
            actorRole: data.actorRole as UserRole,
            action: String(data.action ?? ''),
            targetType: String(data.targetType ?? ''),
            targetId: String(data.targetId ?? ''),
            summary: String(data.summary ?? ''),
            before: (data.before as string | null) ?? null,
            after: (data.after as string | null) ?? null,
            createdAt: toIso(data.createdAt),
          };
        })
      );
    },
    (error) => onError?.(error)
  );
}
