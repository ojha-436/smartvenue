/**
 * Custom hook for real-time Firestore data subscription
 * Manages onSnapshot lifecycle, cleanup, and error handling
 */

import { useEffect, useState, useCallback } from 'react';

/**
 * Hook for subscribing to Firestore collection/query updates
 * Automatically unsubscribes on unmount and when query reference changes
 *
 * @param {import('firebase/firestore').Query|import('firebase/firestore').CollectionReference|null} queryRef
 *   The Firestore collection or query reference to listen to. Can be null for conditional listening.
 * @param {Function} [transformFn] Optional function to transform snapshot documents into data format
 * @returns {{ data: Array, loading: boolean, error: Error|null }}
 *   - data: Array of documents (or transformed data)
 *   - loading: True while initial data is loading
 *   - error: Error object if subscription failed, null otherwise
 *
 * @example
 * const zonesRef = collection(db, 'venues', venueId, 'zones');
 * const { data: zones, loading, error } = useFirestoreListener(zonesRef);
 *
 * @example
 * const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(5));
 * const { data: alerts } = useFirestoreListener(q, snap =>
 *   snap.docs.map(d => ({ id: d.id, ...d.data() }))
 * );
 */
export function useFirestoreListener(queryRef, transformFn) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize the transform function to avoid unnecessary re-subscriptions
  const defaultTransform = useCallback((snapshot) => {
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, []);

  const transform = transformFn || defaultTransform;

  useEffect(() => {
    // Skip if no reference provided
    if (!queryRef) {
      setLoading(false);
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Subscribe to real-time updates
      const unsubscribe = queryRef.onSnapshot(
        (snapshot) => {
          try {
            const transformed = transform(snapshot);
            setData(transformed);
            setError(null);
            setLoading(false);
          } catch (transformErr) {
            console.error('Error transforming Firestore data:', transformErr);
            setError(transformErr);
            setLoading(false);
          }
        },
        (err) => {
          console.error('Firestore listener error:', err);
          setError(err);
          setLoading(false);
        }
      );

      // Cleanup subscription on unmount or reference change
      return () => unsubscribe();
    } catch (err) {
      console.error('Failed to subscribe to Firestore:', err);
      setError(err);
      setLoading(false);
    }
  }, [queryRef, transform]);

  return { data, loading, error };
}

export default useFirestoreListener;
