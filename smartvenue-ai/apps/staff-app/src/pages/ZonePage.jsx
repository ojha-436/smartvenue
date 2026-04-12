import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckCircle, Activity, AlertTriangle } from 'lucide-react';

const CROWD_API = import.meta.env.VITE_CROWD_API;

const ZONES = [
  'gate-1','gate-2','gate-3','gate-4','gate-5','gate-6','gate-7','gate-8',
  'north-stand','south-stand','east-concourse','west-concourse',
  'food-court-a','food-court-b','vip-lounge','main-entry',
];

const statuses = [
  { value: 'clear',    label: 'Clear',    icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  { value: 'busy',     label: 'Busy',     icon: Activity,    color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { value: 'critical', label: 'Critical', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
];

export default function ZonePage({ token, venueId, staff }) {
  const [zone,    setZone]    = useState(ZONES[0]);
  const [status,  setStatus]  = useState('clear');
  const [note,    setNote]    = useState('');
  const [submitting, setSub]  = useState(false);

  const report = async () => {
    setSub(true);
    try {
      await axios.post(`${CROWD_API}/api/crowd/zone-report`, {
        venue_id: venueId,
        zone_id:  zone,
        staff_id: staff?.uid || 'staff',
        status,
        note,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Zone ${zone} reported as ${status}`);
      setNote('');
    } catch {
      toast.error('Could not submit report');
    } finally { setSub(false); }
  };

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-lg font-bold text-gray-800">Zone Status Report</h2>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Select Zone</label>
        <select value={zone} onChange={e => setZone(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
          {ZONES.map(z => <option key={z} value={z}>{z.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Crowd Status</label>
        <div className="space-y-2">
          {statuses.map(({ value, label, icon: Icon, color, bg }) => (
            <button key={value} onClick={() => setStatus(value)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                ${status === value ? bg : 'bg-white border-gray-200'}`}>
              <Icon size={20} className={status === value ? color : 'text-gray-400'} />
              <div>
                <p className={`font-semibold text-sm ${status === value ? color : 'text-gray-600'}`}>{label}</p>
                <p className="text-xs text-gray-400">
                  {value === 'clear' ? 'Normal flow, no issues'
                   : value === 'busy' ? 'Elevated crowd, manageable'
                   : 'Dangerous congestion — needs action'}
                </p>
              </div>
              {status === value && <span className="ml-auto text-green-600">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Notes (optional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Any additional observations…"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
      </div>

      <button onClick={report} disabled={submitting}
        className="w-full bg-green-600 text-white rounded-xl py-4 font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
        {submitting ? 'Submitting…' : '📍 Submit Zone Report'}
      </button>
    </div>
  );
}
