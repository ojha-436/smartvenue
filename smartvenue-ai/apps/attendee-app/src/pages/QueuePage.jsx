/**
 * QueuePage - Virtual queue management
 * Shows available amenities and allows joining/leaving queues
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, X, Plus } from 'lucide-react';
import { useFirestoreListener } from '../shared/hooks/useFirestoreListener';
import { useApi } from '../shared/hooks/useApi';
import { QUEUE_STORAGE_KEY, STATUS_COLORS, STATUS_BG_COLORS } from '../shared/constants';

/**
 * QueuePage component - Manage virtual queues
 */
export default function QueuePage({ user, venueId }) {
  const [myQueues, setMyQueues] = useState({});
  const [joining, setJoining] = useState(null);

  // Real-time amenity queue data from Firestore
  const amenitiesRef = useMemo(() => collection(db, 'venues', venueId, 'queues'), [venueId]);
  const { data: amenities, loading } = useFirestoreListener(amenitiesRef);

  // API hooks for join/leave operations
  const { execute: executeJoin } = useApi(null, { method: 'POST', client: 'queue' });
  const { execute: executeLeave } = useApi(null, { method: 'DELETE', client: 'queue' });

  /**
   * Restore queue membership from localStorage on mount
   */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '{}');
      setMyQueues(saved);
    } catch (err) {
      console.error('Failed to load queue data:', err);
    }
  }, []);

  /**
   * Persist queue membership to localStorage
   */
  const saveQueues = useCallback((q) => {
    setMyQueues(q);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(q));
  }, []);

  /**
   * Join a queue for an amenity
   */
  const joinQueue = useCallback(
    async (amenityId, amenityName) => {
      if (myQueues[amenityId]) {
        toast('You are already in this queue!');
        return;
      }
      setJoining(amenityId);
      try {
        const res = await executeJoin(`/api/queues/${amenityId}/join`, {
          userId: user.uid,
          venueId,
          displayName: user.displayName,
        });
        const { entryId } = res || {};
        if (entryId) {
          saveQueues({ ...myQueues, [amenityId]: entryId });
          toast.success(`Joined queue for ${amenityName}!`);
        }
      } catch (err) {
        toast.error('Could not join queue. Try again.');
        console.error(err);
      } finally {
        setJoining(null);
      }
    },
    [myQueues, user.uid, venueId, user.displayName, saveQueues, executeJoin]
  );

  /**
   * Leave a queue
   */
  const leaveQueue = useCallback(
    async (amenityId, amenityName) => {
      const entryId = myQueues[amenityId];
      if (!entryId) return;
      try {
        await executeLeave(`/api/queues/${amenityId}/leave`, {
          entryId,
          venueId,
        });
        const updated = { ...myQueues };
        delete updated[amenityId];
        saveQueues(updated);
        toast.success(`Left queue for ${amenityName}`);
      } catch (err) {
        toast.error('Could not leave queue. Try again.');
        console.error(err);
      }
    },
    [myQueues, venueId, saveQueues, executeLeave]
  );

  /**
   * Determine status color based on queue length
   */
  const statusColor = useCallback((len) => {
    if (len < 5) return 'text-green-600 bg-green-50';
    if (len < 15) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  }, []);

  const queueCount = useMemo(() => Object.keys(myQueues).length, [myQueues]);

  return (
    <div className="pb-20">
      <div className="bg-blue-600 text-white px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold">Virtual Queue</h1>
        <p className="text-blue-200 text-sm mt-1">
          Join a queue from your seat — we'll notify you when ready
        </p>
      </div>

      {/* Live region announces queue membership changes to screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {queueCount > 0
          ? `You are in ${queueCount} queue${queueCount > 1 ? 's' : ''}.`
          : 'You are not currently in any queue.'}
      </div>

      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10" role="status" aria-live="polite">Loading queues…</p>
        ) : amenities.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No active queues right now</p>
        ) : (
          amenities.map((am) => {
            const inQueue = !!myQueues[am.id];
            const wait = am.avgWaitMins || 0;
            const len = am.length || 0;
            return (
              <div
                key={am.id}
                className={`bg-white rounded-2xl shadow-sm p-4 border-l-4
                ${inQueue ? 'border-blue-500' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{am.amenityId || am.id}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(len)}`}>
                        {len} people
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={11} /> ~{wait} min wait
                      </span>
                    </div>
                  </div>

                  {inQueue ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                        <CheckCircle size={12} /> In Queue
                      </span>
                      <button
                        onClick={() => leaveQueue(am.id, am.amenityId || am.id)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                        aria-label={`Leave queue for ${am.amenityId || am.id}`}
                      >
                        <X size={12} /> Leave
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => joinQueue(am.id, am.amenityId || am.id)}
                      disabled={joining === am.id}
                      className="flex items-center gap-1 bg-blue-600 text-white text-sm font-medium
                        px-3 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      aria-label={`Join queue for ${am.amenityId || am.id}`}
                    >
                      <Plus size={14} />
                      {joining === am.id ? 'Joining…' : 'Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {queueCount > 0 && (
          <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
            <strong>You're in {queueCount} queue(s).</strong>
            <br />
            We'll send you a push notification when it's your turn.
          </div>
        )}
      </div>
    </div>
  );
}
