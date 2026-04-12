import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

const STAFF_API = import.meta.env.VITE_STAFF_API;
const ZONES = ['gate-1','gate-2','gate-3','north-stand','south-stand','food-court-a','food-court-b','vip-lounge','main-entry','east-concourse','west-concourse'];

export default function IncidentPage({ token, venueId }) {
  const [zoneId,      setZoneId]      = useState(ZONES[0]);
  const [severity,    setSeverity]    = useState(1);
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!description.trim()) { toast.error('Please describe the incident'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${STAFF_API}/api/staff/incidents`, {
        venueId, zoneId, severity: Number(severity), description,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Incident reported. Operations team notified.');
      setDescription('');
      setSeverity(1);
    } catch {
      toast.error('Could not report incident');
    } finally { setSubmitting(false); }
  };

  const levels = [
    { v: 1, label: 'Level 1 — Minor',    desc: 'No immediate danger. Monitoring required.', color: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
    { v: 2, label: 'Level 2 — Moderate', desc: 'Potential risk. Staff response needed.',    color: 'border-orange-400 bg-orange-50 text-orange-700' },
    { v: 3, label: 'Level 3 — Critical', desc: 'Immediate danger. Emergency response.',     color: 'border-red-500 bg-red-50 text-red-700' },
  ];

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <AlertTriangle size={20} className="text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Report Incident</h2>
          <p className="text-xs text-gray-500">This will alert the operations team immediately</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Location / Zone</label>
          <select value={zoneId} onChange={e => setZoneId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
            {ZONES.map(z => <option key={z} value={z}>{z.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Severity</label>
          <div className="space-y-2">
            {levels.map(({ v, label, desc, color }) => (
              <button key={v} type="button" onClick={() => setSeverity(v)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all
                  ${severity === v ? color : 'border-gray-200 bg-white text-gray-600'}`}>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs opacity-80">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Describe what you're seeing…"
            rows={4} required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
        </div>

        <button type="submit" disabled={submitting}
          className="w-full bg-red-600 text-white rounded-xl py-4 font-bold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          <AlertTriangle size={18} />
          {submitting ? 'Reporting…' : 'Report Incident'}
        </button>
      </form>
    </div>
  );
}
