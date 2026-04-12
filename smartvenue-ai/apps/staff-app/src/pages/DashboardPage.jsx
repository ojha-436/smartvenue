import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { Users, AlertTriangle, Clock, CheckCircle, Activity } from 'lucide-react';

const CROWD_API = import.meta.env.VITE_CROWD_API;
const QUEUE_API = import.meta.env.VITE_QUEUE_API;

// Minimal Firebase init for Firestore real-time
let db;
if (!getApps().length) {
  const app = initializeApp({ projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID });
  db = getFirestore(app);
} else {
  db = getFirestore();
}

const statusColor = { clear: '#22C55E', busy: '#F97316', critical: '#EF4444' };
const statusBg    = { clear: '#DCFCE7', busy: '#FFEDD5', critical: '#FEE2E2' };

export default function DashboardPage({ token, venueId, staff }) {
  const [zones,  setZones]  = useState([]);
  const [queues, setQueues] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'venues', venueId, 'zones'), snap => {
      setZones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [venueId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'venues', venueId, 'queues'), snap => {
      setQueues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [venueId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'venues', venueId, 'alerts'), snap => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(a => !a.acknowledged)
        .sort((a,b) => b.timestamp?.localeCompare(a.timestamp))
        .slice(0, 5));
    });
    return unsub;
  }, [venueId]);

  const criticalZones = zones.filter(z => z.status === 'critical');
  const totalQueue    = queues.reduce((s, q) => s + (q.length || 0), 0);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Live Overview</h2>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Critical Zones', value: criticalZones.length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'In Queues',      value: totalQueue,           icon: Users,         color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Alerts',  value: alerts.length,       icon: Activity,      color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
            <Icon size={20} className={`${color} mx-auto mb-1`} />
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-2 text-sm">
            <AlertTriangle size={14} /> Active Alerts
          </h3>
          {alerts.map(a => (
            <div key={a.id} className="py-1.5 border-b border-red-100 last:border-0">
              <p className="text-sm text-red-700 font-medium">{a.message || a.alertType}</p>
              <p className="text-xs text-red-400">Zone: {a.zoneId} · {a.severity}</p>
            </div>
          ))}
        </div>
      )}

      {/* Zone Grid */}
      <div>
        <h3 className="font-semibold text-gray-700 text-sm mb-2">Zone Status</h3>
        <div className="grid grid-cols-2 gap-2">
          {zones.map(zone => (
            <div key={zone.id} className="bg-white rounded-xl shadow-sm p-3"
              style={{ borderLeft: `3px solid ${statusColor[zone.status] || '#9CA3AF'}` }}>
              <p className="font-medium text-sm text-gray-800">{zone.name || zone.id}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: statusBg[zone.status] || '#F3F4F6', color: statusColor[zone.status] || '#6B7280' }}>
                  {zone.status || 'clear'}
                </span>
                <span className="text-xs text-gray-400">{zone.occupancyCount || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue Summary */}
      {queues.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 text-sm mb-2">Queue Depths</h3>
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
            {queues.slice(0, 6).map(q => (
              <div key={q.id} className="flex items-center justify-between px-4 py-2.5">
                <p className="text-sm text-gray-800">{q.amenityId || q.id}</p>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{q.length || 0} waiting</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
