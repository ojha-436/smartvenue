import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckCircle, Activity, AlertTriangle } from 'lucide-react';

const CROWD_API = import.meta.env.VITE_CROWD_API;

const ZONES = [
  'gate-1', 'gate-2', 'gate-3', 'gate-4', 'gate-5', 'gate-6', 'gate-7', 'gate-8',
  'north-stand', 'south-stand', 'east-concourse', 'west-concourse',
  'food-court-a', 'food-court-b', 'vip-lounge', 'main-entry',
];

/**
 * Memoized status options with icons and descriptions
 */
const STATUS_OPTIONS = [
  {
    value: 'clear',
    label: 'Clear',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    description: 'Normal flow, no issues',
  },
  {
    value: 'busy',
    label: 'Busy',
    icon: Activity,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    description: 'Elevated crowd, manageable',
  },
  {
    value: 'critical',
    label: 'Critical',
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    description: 'Dangerous congestion — needs action',
  },
];

/**
 * ZonePage - Allows staff to report zone crowd status
 * Provides form for zone selection, status update, and optional notes
 */
export default function ZonePage({ token, venueId, staff }) {
  const [zone, setZone] = useState(ZONES[0]);
  const [status, setStatus] = useState('clear');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * Format zone ID for display (convert kebab-case to Title Case)
   */
  const formatZoneName = useCallback((zoneId) => {
    return zoneId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }, []);

  /**
   * Submit zone status report to API
   */
  const report = async () => {
    setSubmitting(true);
    try {
      await axios.post(
        `${CROWD_API}/api/crowd/zone-report`,
        {
          venue_id: venueId,
          zone_id: zone,
          staff_id: staff?.uid || 'staff',
          status,
          note,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Zone ${zone} reported as ${status}`);
      setNote('');
    } catch {
      toast.error('Could not submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const statusDescription = useMemo(() => {
    const selectedStatus = STATUS_OPTIONS.find(s => s.value === status);
    return selectedStatus?.description || '';
  }, [status]);

  return (
    <div className="p-4 space-y-5">
      {/* Skip link */}
      <a href="#zone-form" className="sr-only focus:not-sr-only focus:bg-blue-600 focus:text-white focus:p-2">
        Skip to zone report form
      </a>

      <h2 className="text-lg font-bold text-gray-800">Zone Status Report</h2>

      <form id="zone-form" className="space-y-5" onSubmit={(e) => { e.preventDefault(); report(); }}>
        {/* Zone selection */}
        <div>
          <label htmlFor="zone-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Select Zone
          </label>
          <select
            id="zone-select"
            value={zone}
            onChange={e => setZone(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            aria-describedby="zone-help"
          >
            {ZONES.map(z => (
              <option key={z} value={z}>
                {formatZoneName(z)}
              </option>
            ))}
          </select>
          <p id="zone-help" className="sr-only">
            Select the zone where you are reporting the crowd status
          </p>
        </div>

        {/* Crowd status selection with aria-live for updates */}
        <div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Crowd Status
            </legend>
            <div role="group" aria-describedby="status-help">
              {STATUS_OPTIONS.map(({ value, label, icon: Icon, color, bg, description }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                    ${status === value ? bg : 'bg-white border-gray-200'}`}
                  role="radio"
                  aria-checked={status === value}
                  aria-label={`${label}: ${description}`}
                >
                  <Icon size={20} className={status === value ? color : 'text-gray-400'} aria-hidden="true" />
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${status === value ? color : 'text-gray-600'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-400">{description}</p>
                  </div>
                  {status === value && (
                    <span className="text-green-600" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p id="status-help" className="sr-only">
              Select the current crowd status for the zone
            </p>
          </fieldset>
        </div>

        {/* Optional notes field */}
        <div>
          <label htmlFor="zone-notes" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Notes (optional)
          </label>
          <textarea
            id="zone-notes"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Any additional observations…"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            aria-describedby="notes-help"
          />
          <p id="notes-help" className="text-xs text-gray-500 mt-1">
            Add context about what you observed (optional)
          </p>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-600 text-white rounded-xl py-4 font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
          aria-busy={submitting}
        >
          {submitting ? 'Submitting…' : '📍 Submit Zone Report'}
        </button>
      </form>
    </div>
  );
}
