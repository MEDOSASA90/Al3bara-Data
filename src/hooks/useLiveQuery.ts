import { useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';

/**
 * Generic live-query hook: subscribes once, keeps data fresh via onSnapshot.
 */
export function useLiveQuery<T>(
  subscribe: (onData: (items: T[]) => void, onError: (error: Error) => void) => Unsubscribe,
): { items: T[]; error: Error | null } {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe(
      (next) => {
        setItems(next);
        setError(null);
      },
      (queryError) => setError(queryError),
    );
    return unsubscribe;
  }, [subscribe]);

  return { items, error };
}
