import type { ReactNode } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { formatDate } from '../../utils/format';

interface AuditBadgeProps {
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

/** Small "معدل • email • date" badge shown wherever updatedBy exists. */
export function AuditBadge(props: AuditBadgeProps): ReactNode {
  const { updatedBy, updatedAt, createdBy } = props;
  if (!updatedBy) {
    if (!createdBy) return null;
    return <span className="chip">👤 {createdBy}</span>;
  }
  const date = updatedAt && typeof updatedAt.toDate === 'function' ? formatDate(updatedAt) : '';
  return (
    <span className="chip" title={`أنشأها ${createdBy ?? '—'}`}>
      معدل • {updatedBy}{date !== '' ? ` • ${date}` : ''}
    </span>
  );
}
