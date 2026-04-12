import React, { useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  Activity, AlertTriangle, Users, ShoppingCart,
  Radio, MapPin, RefreshCw, Bell, Shield, TrendingUp
} from 'lucide-react';

const CROWD_API  = import.meta.env.VITE_CROWD_API;
const STAFF_API  = import.meta.env.VITE_STAFF_API;
const NOTIFY_API = import.meta.env.VITE_NOTIFY_API;
const VENUE_ID   = import.meta.env.VITE_VENUE_ID || 'venue-001';

let db;
if (!getApps().length) {
  const app = initializeApp({ projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID });
  db = getFirestore(app);
} else {
  db = getFirestore();
}

const statusColor  = { clear: '#22C55E', busy: '#F97316', critical: '#EF4444' };
const statusBg     = { clear: '#14532D', busy: '#78350F', critical: '#7F1D1D' };

function KPICard({ title, value, icon: Icon, color, sub }) {
  return (
    <div className="card flex items-start gap-3">
      <div className="rounded-xl p-2" style={{ background: color + '22' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-slate-400 text-xs">{title}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function App() {
  const [zones,  setZones]  = useState([]);
  const [queues, setQueues] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [staff,  setStaff]  = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [tab, setTab] = useState('overview');

  // Real-time Firestore listeners
  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'venues', VENUE_ID, 'zones'), s =>
      setZones(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'venues', VENUE_ID, 'queues'), s =>
      setQueues(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(
      query(collection(db, 'venues', VENUE_ID, 'alerts'), orderBy('timestamp', 'desc'), limit(10)),
      s => setAlerts(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u4 = onSnapshot(
      query(collection(db, 'venues', VENUE_ID, 'staff')),
      s => setStaff(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const criticalCount = zones.filter(z => z.status === 'critical').length;
  const totalQueued   = queues.reduce((s, q) => s + (q.length || 0), 0);
  const activeAlerts  = alerts.filter(a => !a.acknowledged);
  const activeStaff   = staff.filter(s => s.status === 'active').length;

  const broadcastEmergency = async () => {
    if (!broadcastMsg.trim()) { toast.error('Enter a message first'); return; }
    setSending(true);
    try {
      await axios.post(`${NOTIFY_API}/api/notify/emergency`, {
        venueId: VENUE_ID,
        message: broadcastMsg,
      });
      toast.success('Emergency broadcast sent to all attendees');
      setBroadcastMsg('');
    } catch { toast.error('Broadcast failed'); }
    finally { setSending(false); }
  };

  const runPrediction = async () => {
    setPredicting(true);
    try {
      await axios.post(`${CROWD_API}/api/crowd/predict/${VENUE_ID}`);
      toast.success('AI crowd prediction updated');
    } catch { toast.error('Prediction failed'); }
    finally { setPredicting(false); }
  };

  const tabs = [
    { id: 'overview', label: 'Overview',     icon: Activity    },
    { id: 'zones',    label: 'Zones',        icon: MapPin      },
    { id: 'queues',   label: 'Queues',       icon: Users       },
    { id: 'alerts',   label: `Alerts${activeAlerts.length ? ` (${activeAlerts.length})` : ''}`, icon: AlertTriangle },
    { id: 'comms',    label: 'Broadcast',    icon: Radio       },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1E293B', color: '#F1F5F9' } }} />

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">SmartVenue AI</h1>
          <p className="text-slate-400 text-xs">Operations Command Centre · {VENUE_ID}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={runPrediction} disabled={predicting}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <TrendingUp size={14} />
            {predicting ? 'Running AI…' : 'Run AI Prediction'}
          </button>
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> LIVE
          </span>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700 px-6 flex gap-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${tab === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>

      <main className="p-6">

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Critical Zones"  value={criticalCount}   icon={AlertTriangle} color="#EF4444" sub="Require action" />
              <KPICard title="People in Queue" value={totalQueued}     icon={Users}         color="#3B82F6" sub="Across all amenities" />
              <KPICard title="Active Alerts"   value={activeAlerts.length} icon={Bell}      color="#F97316" sub="Unacknowledged" />
              <KPICard title="Staff On Duty"   value={activeStaff}    icon={Shield}        color="#22C55E" sub="GPS-tracked" />
            </div>

            {/* Crowd Density Bar Chart */}
            {zones.length > 0 && (
              <div className="card">
                <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-blue-400" /> Crowd Density by Zone
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={zones.map(z => ({ name: z.name || z.id, density: Math.round((z.densityScore || 0) * 100) }))}
                    margin={{ top: 0, right: 0, bottom: 40, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} unit="%" domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, color: '#F1F5F9' }} formatter={v => [`${v}%`, 'Density']} />
                    <Bar dataKey="density" radius={[4, 4, 0, 0]}>
                      {zones.map((z, i) => (
                        <Cell key={i} fill={z.status === 'critical' ? '#EF4444' : z.status === 'busy' ? '#F97316' : '#22C55E'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent Alerts */}
            {activeAlerts.length > 0 && (
              <div className="card">
                <h3 className="text-slate-300 font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-400" /> Active Alerts
                </h3>
                <div className="space-y-2">
                  {activeAlerts.slice(0, 5).map(a => (
                    <div key={a.id} className="flex items-start gap-3 py-2 border-b border-slate-700 last:border-0">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                        ${a.severity === 'red' ? 'bg-red-500' : 'bg-orange-400'}`} />
                      <div>
                        <p className="text-sm text-slate-200">{a.message || a.alertType}</p>
                        <p className="text-xs text-slate-500">Zone: {a.zoneId} · {a.timestamp?.slice(11, 19) || 'Now'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ZONES TAB */}
        {tab === 'zones' && (
          <div className="space-y-4">
            <h2 className="text-slate-300 font-semibold">All Zones — Live Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {zones.map(zone => (
                <div key={zone.id} className="card" style={{ borderLeft: `3px solid ${statusColor[zone.status] || '#6B7280'}` }}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white">{zone.name || zone.id}</h3>
                    <span className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: statusBg[zone.status] || '#374151', color: statusColor[zone.status] || '#9CA3AF' }}>
                      {(zone.status || 'clear').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Density: <span className="text-white font-medium">{Math.round((zone.densityScore || 0) * 100)}%</span></span>
                    <span>Count: <span className="text-white font-medium">{zone.occupancyCount || 0}</span></span>
                    {zone.predictedDensity15Min !== undefined && (
                      <span className="text-blue-400">
                        15min: {Math.round(zone.predictedDensity15Min * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((zone.densityScore || 0) * 100)}%`,
                        background: statusColor[zone.status] || '#6B7280'
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUEUES TAB */}
        {tab === 'queues' && (
          <div className="space-y-4">
            <h2 className="text-slate-300 font-semibold">Queue Management</h2>
            {queues.map(q => {
              const pct = Math.min(100, ((q.length || 0) / 30) * 100);
              return (
                <div key={q.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white">{q.amenityId || q.id}</h3>
                    <span className="text-slate-300 text-sm font-medium">{q.length || 0} waiting</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct > 80 ? '#EF4444' : pct > 50 ? '#F97316' : '#22C55E' }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">~{q.avgWaitMins || 0} min avg wait</p>
                </div>
              );
            })}
            {queues.length === 0 && <p className="text-slate-400 text-center py-10">No active queues</p>}
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === 'alerts' && (
          <div className="space-y-4">
            <h2 className="text-slate-300 font-semibold">All Alerts</h2>
            {alerts.map(a => (
              <div key={a.id} className={`card border-l-4 ${a.severity === 'red' ? 'border-red-500' : 'border-orange-400'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                        ${a.severity === 'red' ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'}`}>
                        {(a.severity || 'amber').toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500">Zone: {a.zoneId}</span>
                    </div>
                    <p className="text-sm text-slate-200">{a.message || a.alertType}</p>
                    <p className="text-xs text-slate-500 mt-1">{a.timestamp?.replace('T',' ').slice(0,19) || ''}</p>
                  </div>
                  {a.acknowledged && <span className="text-xs text-green-400">Acknowledged</span>}
                </div>
              </div>
            ))}
            {alerts.length === 0 && <p className="text-slate-400 text-center py-10">No alerts</p>}
          </div>
        )}

        {/* BROADCAST TAB */}
        {tab === 'comms' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-slate-300 font-semibold">Emergency Broadcast</h2>
            <div className="card bg-red-950 border border-red-800">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-400" />
                <h3 className="text-red-300 font-semibold">Send to All {VENUE_ID} Attendees</h3>
              </div>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                placeholder="Type emergency message… (e.g. 'Please remain calm and proceed to the nearest exit')"
                rows={4}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-200
                  focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4" />
              <button onClick={broadcastEmergency} disabled={sending || !broadcastMsg.trim()}
                className="w-full bg-red-600 text-white rounded-xl py-3 font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Radio size={16} />
                {sending ? 'Broadcasting…' : '🚨 SEND EMERGENCY BROADCAST'}
              </button>
              <p className="text-xs text-red-400 text-center mt-2">This will send FCM push notifications to all attendees immediately.</p>
            </div>

            <div className="card">
              <h3 className="text-slate-300 font-semibold mb-3">General Announcement</h3>
              <p className="text-slate-400 text-sm">Use the section above for emergency broadcasts only. For regular announcements, configure digital signage content via the Admin API.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
