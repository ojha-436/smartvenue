/**
 * VenueMapPage - Interactive venue map showing live crowd density
 * Displays zones as a grid with density visualization and detail cards
 */

import React, { useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection } from 'firebase/firestore';
import { AlertTriangle, CheckCircle, Activity, Info } from 'lucide-react';
import { useFirestoreListener } from '../shared/hooks/useFirestoreListener';
import { STATUS_BG_COLORS, STATUS_COLORS } from '../shared/constants';

/**
 * VenueMapPage component - Interactive venue map with live crowd data
 */
export default function VenueMapPage({ venueId }) {
  const [selected, setSelected] = useState(null);

  // Real-time zone data subscription
  const zonesRef = useMemo(() => collection(db, 'venues', venueId, 'zones'), [venueId]);
  const { data: zones } = useFirestoreListener(zonesRef);

  // Memoize icon map to avoid recreating on every render
  const iconMap = useMemo(
    () => ({
      clear: <CheckCircle size={14} className="text-green-600" />,
      busy: <Activity size={14} className="text-orange-600" />,
      critical: <AlertTriangle size={14} className="text-red-600" />,
    }),
    []
  );

  /**
   * Handle zone selection for detail view
   */
  const handleZoneSelect = useMemo(
    () => (zone) => {
      setSelected(selected?.id === zone.id ? null : zone);
    },
    [selected]
  );

  /**
   * Generate placeholder zones while loading
   */
  const placeholderZones = useMemo(() => [
    'North Stand',
    'East Gate',
    'VIP Lounge',
    'Concourse A',
    'Concourse B',
    'South Gate',
    'Food Court',
    'Merchandise',
    'Main Entry',
  ], []);

  return (
    <div className="pb-20">
      <div className="bg-blue-600 text-white px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold">Venue Map</h1>
        <p className="text-blue-200 text-sm mt-1">Live crowd density — updates every 60 seconds</p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-3 bg-white border-b border-gray-100 text-xs font-medium">
        {[
          ['clear', STATUS_COLORS.clear, 'Clear'],
          ['busy', STATUS_COLORS.busy, 'Busy'],
          ['critical', STATUS_COLORS.critical, 'Crowded'],
        ].map(([status, color, label]) => (
          <span key={status} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Schematic Grid Map */}
      <div className="px-4 mt-4">
        <div className="bg-gray-100 rounded-2xl p-4">
          <h2 className="text-xs text-gray-500 text-center mb-4 font-semibold uppercase tracking-wider">Stadium Overview</h2>

          {/* Grid-based venue schematic */}
          <div className="grid grid-cols-3 gap-3">
            {zones.length === 0
              ? placeholderZones.map((name) => (
                  <div
                    key={name}
                    className="bg-gray-200 rounded-xl p-3 text-center animate-pulse h-20"
                    aria-hidden="true"
                  />
                ))
              : zones.map((zone) => {
                  const status = zone.status || 'clear';
                  const density = Math.round((zone.densityScore || 0) * 100);
                  return (
                    <button
                      key={zone.id}
                      onClick={() => handleZoneSelect(zone)}
                      className="rounded-xl p-3 text-center transition-all active:scale-95"
                      style={{
                        background: STATUS_BG_COLORS[status] || '#F3F4F6',
                      }}
                      aria-label={`${zone.name || zone.id}, ${density}% density`}
                      aria-pressed={selected?.id === zone.id}
                    >
                      <div className="flex justify-center mb-1">
                        {iconMap[status] || iconMap.clear}
                      </div>
                      <p className="text-xs font-semibold text-gray-800 leading-tight">
                        {zone.name || zone.id}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{
                          color: STATUS_COLORS[status] || '#6B7280',
                        }}
                      >
                        {density}%
                      </p>
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Zone Detail Card */}
        {selected && (
          <div
            className="mt-4 bg-white rounded-2xl shadow-sm p-4 border-l-4"
            style={{
              borderColor: STATUS_COLORS[selected.status] || '#9CA3AF',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-base">
                  {selected.name || selected.id}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Occupancy: {selected.occupancyCount || 0} people
                </p>
                {selected.predictedDensity15Min !== undefined && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <Info size={11} />
                    Predicted in 15 min: {Math.round(selected.predictedDensity15Min * 100)}%
                  </p>
                )}
              </div>
              <span
                className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{
                  background: STATUS_BG_COLORS[selected.status],
                  color: STATUS_COLORS[selected.status],
                }}
                aria-label={`Status: ${(selected.status || 'clear').toUpperCase()}`}
              >
                {(selected.status || 'CLEAR').toUpperCase()}
              </span>
            </div>
            {selected.status === 'critical' && (
              <div className="mt-3 bg-red-50 rounded-lg p-2 text-xs text-red-700">
                ⚠️ This area is very crowded. Consider an alternative route.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 mt-4 bg-blue-50 rounded-2xl p-4 text-xs text-blue-700">
        <strong>Crowd data</strong> is updated every 60 seconds from app check-ins and staff
        reports. Tap any zone for details.
      </div>
    </div>
  );
}
