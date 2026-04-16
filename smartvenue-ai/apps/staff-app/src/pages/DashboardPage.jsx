import React, { useEffect, useState, useMemo, useCallback } from 'react';
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

/**
 * Memoized status color mapping for consistent styling
 */
const STATUS_COLORS = {
  clear: '#22C55E',
  busy: '#F97316',
  critical: '#EF4444',
};

const STATUS_BG = {
  clear: '#DCFCE7',
  busy: '#FFEDD5',
  critical: '#FEE2E2',
};

/**
 * DashboardPage - Staff dashboard showing live overview of venue status
 * Displays KPIs, active alerts, zone status, and queue depths with real-time updates
 */
export default function DashboardPage({ token, venueId, staff }) {
  const [zones, setZones] = useState([]);
  const [queues, setQueues] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Real-time Firestore listeners for zones
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'venues', venueId, 'zones'), snap => {
      setZones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [venueId]);

  // Real-time Firestore listeners for queues
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'venues', venueId, 'queues'), snap => {
      setQueues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [venueId]);

  // Real-time Firestore listeners for alerts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'venues', venueId, 'alerts'), snap => {
      setAlerts(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => !a.acknowledged)
          .sort((a, b) => b.timestamp?.localeCompare(a.timestamp))
          .slice(0, 5)
      );
    });
    return unsub;
  }, [venueId]);

  // Memoized computed values for KPIs
  const kpiData = useMemo(() => {
    const criticalZones = zones.filter(z => z.status === 'critical');
    const totalQueue = queues.reduce((s, q) => s + (q.length || 0), 0);

    return {
      criticalCount: criticalZones.length,
      totalQueued: totalQueue,
      activeAlertsCount: alerts.length,
    };
  }, [zones, queues, alerts]);

  const kpiItems = useMemo(
    () => [
      {
        label: 'Critical Zones',
        value: kpiData.criticalCount,
        icon: AlertTriangle,
        color: 'text-red-600',
        bg: 'bg-red-50',
      },
      {
        label: 'In Queues',
        value: kpiData.totalQueued,
        icon: Users,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
      },
      {
        label: 'Active Alerts',
        value: kpiData.activeAlertsCount,
        icon: Activity,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
      },
    ],
    [kpiData]
  );

  return (
    <div className="p-4 space-y-4">
      {/* Main heading */}
      <h2 className="text-lg font-bold text-gray-800">Live Overview</h2>

      {/* KPI Row with accessible cards */}
      <div className="grid grid-cols-3 gap-3">
        {kpiItems.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-3 text-center`} role="region" aria-label={`${label}: ${value}`}>
            <Icon size={20} className={`${color} mx-auto mb-1`} aria-hidden="true" />
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Alerts section with aria-live for dynamic updates */}
      {alerts.length > 0 && (
        <section
          className="bg-red-50 border border-red-200 rounded-2xl p-4"
          role="region"
          aria-live="polite"
          aria-label="Active alerts"
        >
          <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-2 text-sm">
            <AlertTriangle size={14} aria-hidden="true" /> Active Alerts
          </h3>
          <ul className="space-y-1.5">
            {alerts.map(a => (
              <li key={a.id} className="py-1.5 border-b border-red-100 last:border-0">
                <p className="text-sm text-red-700 font-medium">{a.message || a.alertType}</p>
                <p className="text-xs text-red-400">
                  <span className="sr-only">Zone: </span>
                  {a.zoneId}
                  <span className="mx-1">·</span>
                  <span className="sr-only">Severity: </span>
                  {a.severity}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Zone status grid */}
      <section role="region" aria-label="Zone status overview">
        <h3 className="font-semibold text-gray-700 text-sm mb-2">Zone Status</h3>
        <div className="grid grid-cols-2 gap-2">
          {zones.map(zone => (
            <article
              key={zone.id}
              className="bg-white rounded-xl shadow-sm p-3"
              style={{ borderLeft: `3px solid ${STATUS_COLORS[zone.status] || '#9CA3AF'}` }}
              role="region"
              aria-label={`${zone.name || zone.id}: ${zone.status}`}
            >
              <p className="font-medium text-sm text-gray-800">{zone.name || zone.id}</p>
              <div className="flex items-center justify-between mt-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: STATUS_BG[zone.status] || '#F3F4F6',
                    color: STATUS_COLORS[zone.status] || '#6B7280',
                  }}
                >
                  {zone.status || 'clear'}
                </span>
                <span className="text-xs text-gray-400" aria-label="Occupancy">
                  {zone.occupancyCount || 0} people
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Queue summary */}
      {queues.length > 0 && (
        <section role="region" aria-label="Queue depth summary">
          <h3 className="font-semibold text-gray-700 text-sm mb-2">Queue Depths</h3>
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
            {queues.slice(0, 6).map(q => (
              <div key={q.id} className="flex items-center justify-between px-4 py-2.5">
                <p className="text-sm text-gray-800">{q.amenityId || q.id}</p>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-gray-400" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-700" aria-label="People waiting">
                    {q.length || 0} waiting
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
