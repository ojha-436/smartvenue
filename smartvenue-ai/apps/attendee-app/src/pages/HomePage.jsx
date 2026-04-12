import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Bell, MapPin, Clock, ShoppingCart, AlertTriangle, CheckCircle, Activity } from 'lucide-react';

const CROWD_API = import.meta.env.VITE_CROWD_API;

function StatusBadge({ status }) {
  const map = {
    clear:    { cls: 'status-clear',    label: 'Clear',    icon: CheckCircle },
    busy:     { cls: 'status-busy',     label: 'Busy',     icon: Activity    },
    critical: { cls: 'status-critical', label: 'Crowded',  icon: AlertTriangle },
  };
  const { cls, label, icon: Icon } = map[status] || map.clear;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <Icon size={12} /> {label}
    </span>
  );
}

export default function HomePage({ user, venueId }) {
  const [zones,  setZones]  = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time Firestore listener for crowd zones
  useEffect(() => {
    const zonesRef = collection(db, 'venues', venueId, 'zones');
    const unsub = onSnapshot(zonesRef, snap => {
      setZones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [venueId]);

  // Active alerts
  useEffect(() => {
    const alertsRef = query(
      collection(db, 'venues', venueId, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(alertsRef, snap => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [venueId]);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white px-4 pt-12 pb-6">
        <p className="text-blue-200 text-sm">Welcome back</p>
        <h1 className="text-2xl font-bold">{user.displayName || 'Fan'} 👋</h1>
        <p className="text-blue-200 text-sm mt-1 flex items-center gap-1">
          <MapPin size={13} /> Stadium Arena · Gate 3
        </p>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Quick actions */}
        <div className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Venue Map',    icon: MapPin,        to: '/map',   color: 'bg-blue-50 text-blue-600'   },
            { label: 'Join Queue',   icon: Clock,         to: '/queue', color: 'bg-green-50 text-green-600' },
            { label: 'Order Food',   icon: ShoppingCart,  to: '/order', color: 'bg-orange-50 text-orange-600' },
            { label: 'Alerts',       icon: Bell,          to: '/me',    color: 'bg-purple-50 text-purple-600' },
          ].map(({ label, icon: Icon, to, color }) => (
            <Link key={label} to={to}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl ${color} font-medium text-sm transition-transform active:scale-95`}>
              <Icon size={24} />
              {label}
            </Link>
          ))}
        </div>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
              <AlertTriangle size={16} /> Active Alerts
            </h3>
            {alerts.map(a => (
              <p key={a.id} className="text-sm text-red-700 py-1 border-b border-red-100 last:border-0">
                {a.message || a.severity}
              </p>
            ))}
          </div>
        )}

        {/* Zone Status */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-blue-600" /> Live Zone Status
          </h2>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading crowd data…</p>
          ) : zones.length === 0 ? (
            <p className="text-gray-400 text-sm">No zones available</p>
          ) : (
            <div className="space-y-2">
              {zones.slice(0, 6).map(zone => (
                <div key={zone.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
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
        </div>

        {/* Predicted arrival tip */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <h3 className="font-semibold text-blue-800 mb-1">💡 Smart Tip</h3>
          <p className="text-sm text-blue-700">
            Gate 7 is currently clear. Using Gate 7 instead of Gate 3 saves ~8 minutes of wait time.
          </p>
        </div>
      </div>
    </div>
  );
}
