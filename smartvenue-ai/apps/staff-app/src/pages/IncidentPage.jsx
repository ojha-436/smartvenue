import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

const STAFF_API = import.meta.env.VITE_STAFF_API;

const ZONES = [
  'gate-1', 'gate-2', 'gate-3', 'north-stand', 'south-stand',
  'food-court-a', 'food-court-b', 'vip-lounge', 'main-entry',
  'east-concourse', 'west-concourse',
];

/**
 * Memoized severity levels with descriptions
 */
const SEVERITY_LEVELS = [
  {
    value: 1,
    label: 'Level 1 — Minor',
    description: 'No immediate danger. Monitoring required.',
    color: 'border-yellow-400 bg-yellow-50 text-yellow-700',
  },
  {
    value: 2,
    label: 'Level 2 — Moderate',
    description: 'Potential risk. Staff response needed.',
    color: 'border-orange-400 bg-orange-50 text-orange-700',
  },
  {
    value: 3,
    label: 'Level 3 — Critical',
    description: 'Immediate danger. Emergency response.',
    color: 'border-red-500 bg-red-50 text-red-700',
  },
];

/**
 * IncidentPage - Critical incident reporting interface
 * Allows staff to quickly report and escalate incidents with severity levels
 */
export default function IncidentPage({ token, venueId }) {
  const [zoneId, setZoneId] = useState(ZONES[0]);
  const [severity, setSeverity] = useState(1);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * Format zone ID for display
   */
  const formatZoneName = useCallback((zoneId) => {
    return zoneId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }, []);

  /**
   * Get severity level details
   */
  const getSeverityLevel = useCallback((sev) => {
    return SEVERITY_LEVELS.find(l => l.value === sev);
  }, []);

  /**
   * Submit incident report
   */
  const submit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please describe the incident');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${STAFF_API}/api/staff/incidents`,
        {
          venueId,
          zoneId,
          severity: Number(severity),
          description,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Incident reported. Operations team notified.');
      setDescription('');
      setSeverity(1);
    } catch {
      toast.error('Could not report incident');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSeverity = useMemo(() => getSeverityLevel(severity), [severity, getSeverityLevel]);

  return (
    <div className="p-4 space-y-5">
      {/* Skip link */}
      <a href="#incident-form" className="sr-only focus:not-sr-only focus:bg-blue-600 focus:text-white focus:p-2">
        Skip to incident report form
      </a>

      {/* Header with icon */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <AlertTriangle size={20} className="text-red-600" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Report Incident</h2>
          <p className="text-xs text-gray-500">This will alert the operations team immediately</p>
        </div>
      </div>

      <form id="incident-form" onSubmit={submit} className="space-y-4">
        {/* Zone selection */}
        <div>
          <label htmlFor="zone-incident" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Location / Zone
          </label>
          <select
            id="zone-incident"
            value={zoneId}
            onChange={e => setZoneId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
          >
            {ZONES.map(z => (
              <option key={z} value={z}>
                {formatZoneName(z)}
              </option>
            ))}
          </select>
        </div>

        {/* Severity selection */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
            Severity Level
          </legend>
          <div role="group" aria-describedby="severity-help">
            {SEVERITY_LEVELS.map(({ value, label, description, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSeverity(value)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all mb-2
                  ${severity === value ? color : 'border-gray-200 bg-white text-gray-600'}`}
                role="radio"
                aria-checked={severity === value}
                aria-label={`${label}: ${description}`}
              >
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs opacity-80">{description}</p>
              </button>
            ))}
          </div>
          <p id="severity-help" className="sr-only">
            Select the severity level of the incident
          </p>
        </fieldset>

        {/* Description field */}
        <div>
          <label htmlFor="incident-description" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Description
          </label>
          <textarea
            id="incident-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what you're seeing…"
            rows={4}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            aria-describedby="description-help"
            aria-required="true"
          />
          <p id="description-help" className="text-xs text-gray-500 mt-1">
            Be as detailed as possible. This information will be used by the operations team.
          </p>
        </div>

        {/* Submit button with status indicator */}
        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="w-full bg-red-600 text-white rounded-xl py-4 font-bold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          aria-busy={submitting}
          aria-label="Report incident to operations team"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          {submitting ? 'Reporting…' : 'Report Incident'}
        </button>

        {/* Security notice */}
        <p className="text-xs text-red-600 text-center">
          All incident reports are logged and reviewed by the operations team in real-time.
        </p>
      </form>
    </div>
  );
}
