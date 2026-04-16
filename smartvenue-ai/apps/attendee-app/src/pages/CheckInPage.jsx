/**
 * CheckInPage - Gate check-in interface
 * Allows attendees to check in at venue gates with ticket validation
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { QrCode, Check } from 'lucide-react';
import { useApi } from '../shared/hooks/useApi';

/**
 * CheckInPage component - Gate check-in system
 */
export default function CheckInPage({ venueId }) {
  const [gateId, setGateId] = useState('gate-3');
  const [ticketId, setTicketId] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  // API hook for check-in
  const { execute: executeCheckin, loading } = useApi(null, {
    method: 'POST',
    client: 'attendee',
  });

  /**
   * Handle check-in submission
   */
  const handleCheckin = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        await executeCheckin('/api/attendees/checkin', {
          venueId,
          gateId,
          ticketId,
        });
        setDone(true);
        toast.success('Checked in! Welcome to the venue 🎉');
        setTimeout(() => navigate('/home'), 2000);
      } catch (err) {
        toast.error('Check-in failed. Try again.');
        console.error(err);
      }
    },
    [venueId, gateId, ticketId, executeCheckin, navigate]
  );

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-blue-50">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          {done ? (
            <Check size={28} className="text-white" />
          ) : (
            <QrCode size={28} className="text-white" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-800">
          {done ? 'All Set!' : 'Gate Check-In'}
        </h1>
        <p className="text-gray-500 text-sm mt-2">
          {done ? 'Enjoy the match!' : 'Enter your ticket details to check in'}
        </p>
      </div>

      {!done && (
        <form onSubmit={handleCheckin} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <label htmlFor="gate-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Your Gate
            </label>
            <select
              id="gate-select"
              value={gateId}
              onChange={(e) => setGateId(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['gate-1', 'gate-2', 'gate-3', 'gate-4', 'gate-5', 'gate-6', 'gate-7', 'gate-8'].map(
                (g) => (
                  <option key={g} value={g}>
                    {g.replace('-', ' ').toUpperCase()}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label htmlFor="ticket-input" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Ticket ID (optional)
            </label>
            <input
              id="ticket-input"
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. TKT-ABC12345"
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Checking in…' : 'Check In'}
          </button>
        </form>
      )}
    </div>
  );
}
