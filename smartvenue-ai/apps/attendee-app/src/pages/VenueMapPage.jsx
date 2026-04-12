import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, CheckCircle, Activity, Info } from 'lucide-react';

export default function VenueMapPage({ venueId }) {
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const ref = collection(db, 'venues', venueId, 'zones');
    return onSnapshot(ref, snap => setZones(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [venueId]);

  const colorMap = { clear: '#22C55E', busy: '#F97316', critical: '#EF4444' };
  const bgMap    = { clear: '#DCFCE7', busy: '#FFEDD5', critical: '#FEE2E2' };
  const iconMap  = {
    clear:    <CheckCircle size={14} className="text-green-600" />,
    busy:     <Activity    size={14} className="text-orange-600" />,
    critical: <AlertTriangle size={14} className="text-red-600" />,
  };

  return (
    <div className="pb-20">
      <div className="bg-blue-600 text-white px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold">Venue Map</h1>
        <p className="text-blue-200 text-sm mt-1">Live crowd density — updates every 60 seconds</p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-3 bg-white border-b border-gray-100 text-xs font-medium">
        {[['clear','#22C55E','Clear'],['busy','#F97316','Busy'],['critical','#EF4444','Crowded']].map(([s,c,l]) => (
          <span key={s} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>

      {/* Schematic Grid Map */}
      <div className="px-4 mt-4">
        <div className="bg-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 text-center mb-4 font-medium">STADIUM OVERVIEW</p>

          {/* Simplified grid-based venue schematic */}
          <div className="grid grid-cols-3 gap-3">
            {zones.length === 0 ? (
              ['North Stand','East Gate','VIP Lounge','Concourse A','Concourse B','South Gate',
               'Food Court','Merchandise','Main Entry'].map(name => (
                <div key={name} className="bg-gray-200 rounded-xl p-3 text-center animate-pulse h-20" />
              ))
            ) : (
              zones.map(zone => {
                const status = zone.status || 'clear';
                const density = Math.round((zone.densityScore || 0) * 100);
                return (
                  <button key={zone.id}
                    onClick={() => setSelected(selected?.id === zone.id ? null : zone)}
                    className="rounded-xl p-3 text-center transition-all active:scale-95"
                    style={{ background: bgMap[status] || '#F3F4F6' }}>
                    <div className="flex justify-center mb-1">{iconMap[status] || iconMap.clear}</div>
                    <p className="text-xs font-semibold text-gray-800 leading-tight">{zone.name || zone.id}</p>
                    <p className="text-xs mt-0.5" style={{ color: colorMap[status] || '#6B7280' }}>
                      {density}%
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Zone Detail Card */}
        {selected && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm p-4 border-l-4"
            style={{ borderColor: colorMap[selected.status] || '#9CA3AF' }}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-base">{selected.name || selected.id}</h3>
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
              <span className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{ background: bgMap[selected.status], color: colorMap[selected.status] }}>
                {selected.status?.toUpperCase()}
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
        <strong>Crowd data</strong> is updated every 60 seconds from app check-ins and staff reports.
        Tap any zone for details.
      </div>
    </div>
  );
}
