import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, X, Plus } from 'lucide-react';

const QUEUE_API = import.meta.env.VITE_QUEUE_API;

export default function QueuePage({ user, venueId }) {
  const [amenities, setAmenities] = useState([]);
  const [myQueues,  setMyQueues]  = useState({});  // amenityId -> entryId
  const [loading,   setLoading]   = useState(true);
  const [joining,   setJoining]   = useState(null);

  // Real-time amenity queue data from Firestore
  useEffect(() => {
    const ref = collection(db, 'venues', venueId, 'queues');
    const unsub = onSnapshot(ref, snap => {
      setAmenities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [venueId]);

  // Restore my queues from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('myQueues') || '{}');
      setMyQueues(saved);
    } catch {}
  }, []);

  const saveQueues = (q) => {
    setMyQueues(q);
    localStorage.setItem('myQueues', JSON.stringify(q));
  };

  const joinQueue = async (amenityId, amenityName) => {
    if (myQueues[amenityId]) {
      toast('You are already in this queue!');
      return;
    }
    setJoining(amenityId);
    try {
      const res = await axios.post(`${QUEUE_API}/api/queues/${amenityId}/join`, {
        userId: user.uid,
        venueId,
        displayName: user.displayName,
      });
      const { entryId } = res.data;
      saveQueues({ ...myQueues, [amenityId]: entryId });
      toast.success(`Joined queue for ${amenityName}!`);
    } catch (err) {
      toast.error('Could not join queue. Try again.');
    } finally {
      setJoining(null);
    }
  };

  const leaveQueue = async (amenityId, amenityName) => {
    const entryId = myQueues[amenityId];
    if (!entryId) return;
    try {
      await axios.delete(`${QUEUE_API}/api/queues/${amenityId}/leave`, {
        data: { entryId, venueId },
      });
      const updated = { ...myQueues };
      delete updated[amenityId];
      saveQueues(updated);
      toast.success(`Left queue for ${amenityName}`);
    } catch {
      toast.error('Could not leave queue. Try again.');
    }
  };

  const statusColor = (len) => {
    if (len < 5)  return 'text-green-600 bg-green-50';
    if (len < 15) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="pb-20">
      <div className="bg-blue-600 text-white px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold">Virtual Queue</h1>
        <p className="text-blue-200 text-sm mt-1">Join a queue from your seat — we'll notify you when ready</p>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10">Loading queues…</p>
        ) : amenities.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No active queues right now</p>
        ) : (
          amenities.map(am => {
            const inQueue = !!myQueues[am.id];
            const wait    = am.avgWaitMins || 0;
            const len     = am.length || 0;
            return (
              <div key={am.id} className={`bg-white rounded-2xl shadow-sm p-4 border-l-4
                ${inQueue ? 'border-blue-500' : 'border-gray-200'}`}>
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
                      <button onClick={() => leaveQueue(am.id, am.amenityId || am.id)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                        <X size={12} /> Leave
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => joinQueue(am.id, am.amenityId || am.id)}
                      disabled={joining === am.id}
                      className="flex items-center gap-1 bg-blue-600 text-white text-sm font-medium
                        px-3 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      <Plus size={14} />
                      {joining === am.id ? 'Joining…' : 'Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {Object.keys(myQueues).length > 0 && (
          <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
            <strong>You're in {Object.keys(myQueues).length} queue(s).</strong>
            <br />We'll send you a push notification when it's your turn.
          </div>
        )}
      </div>
    </div>
  );
}
