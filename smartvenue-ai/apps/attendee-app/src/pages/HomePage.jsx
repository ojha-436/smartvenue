/**
 * HomePage - Main dashboard showing live zone status and smart recommendations
 * Displays real-time crowd density, active alerts, and smart navigation tips
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Bell, MapPin, Clock, ShoppingCart, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import { useFirestoreListener } from '../shared/hooks/useFirestoreListener';
import { useSmartTips } from '../shared/hooks/useSmartTips';
import { STATUS_BG_COLORS, STATUS_COLORS } from '../shared/constants';

/**
 * Status badge component showing zone crowd status
 * @param {string} status - Zone status: 'clear', 'busy', or 'critical'
 */
function StatusBadge({ status }) {
  const statusMap = {
    clear: { cls: 'status-clear', label: 'Clear', icon: CheckCircle },
    busy: { cls: 'status-busy', label: 'Busy', icon: Activity },
    critical: { cls: 'status-critical', label: 'Crowded', icon: AlertTriangle },
  };
  const { cls, label, icon: Icon } = statusMap[status] || statusMap.clear;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}
    >
      <Icon size={12} aria-hidden="true" /> {label}
    </span>
  );
}

/**
 * HomePage component - Main attendee dashboard
 */
export default function HomePage({ user, venueId }) {
  // Real-time Firestore listeners for zones and alerts
  const zonesRef = useMemo(() => collection(db, 'venues', venueId, 'zones'), [venueId]);
  const { data: zones, loading: zonesLoading } = useFirestoreListener(zonesRef);

  const alertsRef = useMemo(
    () => query(
      collection(db, 'venues', venueId, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(5)
    ),
    [venueId]
  );
  const { data: alerts } = useFirestoreListener(alertsRef);

  // Generate smart navigation tips
  const { tip, alternativeZone, timeSaved } = useSmartTips(zones);

  // Memoize filtered zones for display
  const displayZones = useMemo(() => zones.slice(0, 6), [zones]);

  return (
    <div className="pb-20">
      {/* Accessible Header */}
      <header className="bg-gradient-to-br from-blue-600 to-blue-800 text-white px-4 pt-12 pb-6">
        <p className="text-blue-200 text-sm">Welcome back</p>
        <h1 className="text-2xl font-bold">
          {user.displayName || 'Fan'} <span aria-hidden="true">👋</span>
        </h1>
        <p className="text-blue-200 text-sm mt-1 flex items-center gap-1">
          <MapPin size={13} aria-hidden="true" /> Stadium Arena · Gate 3
        </p>
      </header>

      {/* Main Content Area */}
      <main className="px-4 -mt-4 space-y-4">
        {/* Quick actions with semantic nav tag */}
        <nav
          aria-label="Quick Actions"
          className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-2 gap-3"
        >
          {[
            { label: 'Venue Map', icon: MapPin, to: '/map', color: 'bg-blue-50 text-blue-600' },
            { label: 'Join Queue', icon: Clock, to: '/queue', color: 'bg-green-50 text-green-600' },
            { label: 'Order Food', icon: ShoppingCart, to: '/order', color: 'bg-orange-50 text-orange-600' },
            { label: 'Alerts', icon: Bell, to: '/me', color: 'bg-purple-50 text-purple-600' },
          ].map(({ label, icon: Icon, to, color }) => (
            <Link
              key={label}
              to={to}
              aria-label={label}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl ${color} font-medium text-sm transition-transform active:scale-95`}
            >
              <Icon size={24} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Active Alerts - Assertive live region */}
        {alerts.length > 0 && (
          <section
            className="bg-red-50 border border-red-200 rounded-2xl p-4"
            aria-live="assertive"
            role="alert"
          >
            <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
              <AlertTriangle size={16} aria-hidden="true" /> Active Alerts
            </h3>
            {alerts.map((a) => (
              <p
                key={a.id}
                className="text-sm text-red-700 py-1 border-b border-red-100 last:border-0"
              >
                {a.message || a.severity}
              </p>
            ))}
          </section>
        )}

        {/* Zone Status - Polite live region */}
        <section className="bg-white rounded-2xl shadow-sm p-4" aria-live="polite" aria-busy={zonesLoading}>
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-blue-600" aria-hidden="true" /> Live Zone Status
          </h2>
          {zonesLoading ? (
            <>
              <p className="text-gray-400 text-sm" aria-hidden="true">
                Loading crowd data…
              </p>
              <span className="sr-only">Loading live zone status...</span>
            </>
          ) : zones.length === 0 ? (
            <p className="text-gray-400 text-sm">No zones available</p>
          ) : (
            <div className="space-y-2">
              {displayZones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-800">{zone.name || zone.id}</p>
                    <p className="text-xs text-gray-400">
                      {zone.occupancyCount ? `${zone.occupancyCount} people` : 'Live data'}
                    </p>
                  </div>
                  <StatusBadge status={zone.status || 'clear'} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Predicted arrival tip - Semantic aside */}
        <aside className="bg-blue-50 border border-blue-200 rounded-2xl p-4" aria-label="Smart Tip">
          <h3 className="font-semibold text-blue-800 mb-1 flex items-center gap-1">
            <span aria-hidden="true">💡</span> Smart Tip
          </h3>
          <p className="text-sm text-blue-700">
            {tip}
            {alternativeZone && timeSaved > 0 && (
              <span className="block mt-1 font-medium">
                Estimated time saved: {timeSaved} minutes
              </span>
            )}
          </p>
        </aside>
      </main>
    </div>
  );
}
