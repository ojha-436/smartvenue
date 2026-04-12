import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import toast from 'react-hot-toast';
import { QrCode, Check } from 'lucide-react';

const ATTENDEE_API = import.meta.env.VITE_ATTENDEE_API;

export default function CheckInPage({ venueId }) {
  const [gateId,   setGateId]   = useState('gate-3');
  const [ticketId, setTicketId] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const navigate = useNavigate();

  const handleCheckin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth  = getAuth();
      const token = await auth.currentUser?.getIdToken();
      await axios.post(`${ATTENDEE_API}/api/attendees/checkin`, { venueId, gateId, ticketId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDone(true);
      toast.success('Checked in! Welcome to the venue 🎉');
      setTimeout(() => navigate('/home'), 2000);
    } catch { toast.error('Check-in failed. Try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-blue-50">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          {done ? <Check size={28} className="text-white" /> : <QrCode size={28} className="text-white" />}
        </div>
        <h1 className="text-2xl font-bold text-gray-800">{done ? 'All Set!' : 'Gate Check-In'}</h1>
        <p className="text-gray-500 text-sm mt-2">{done ? 'Enjoy the match!' : 'Enter your ticket details to check in'}</p>
      </div>

      {!done && (
        <form onSubmit={handleCheckin} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Gate</label>
            <select value={gateId} onChange={e => setGateId(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['gate-1','gate-2','gate-3','gate-4','gate-5','gate-6','gate-7','gate-8'].map(g => (
                <option key={g} value={g}>{g.replace('-', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket ID (optional)</label>
            <input value={ticketId} onChange={e => setTicketId(e.target.value)}
              placeholder="e.g. TKT-ABC12345"
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Checking in…' : 'Check In'}
          </button>
        </form>
      )}
    </div>
  );
}
