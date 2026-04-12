import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const STAFF_API = import.meta.env.VITE_STAFF_API;

export default function LoginPage({ onLogin, venueId }) {
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [busy,  setBusy]  = useState(false);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await axios.post(`${STAFF_API}/api/staff/login`, { email, password: pass, venueId });
      onLogin(res.data.token, { email, role: res.data.role, displayName: res.data.displayName });
      toast.success('Welcome back!');
    } catch {
      toast.error('Invalid credentials');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-gradient-to-br from-green-700 to-green-900">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">SmartVenue</h1>
        <p className="text-green-200 text-sm mt-1">Staff Portal</p>
      </div>
      <form onSubmit={login} className="bg-white rounded-3xl p-6 shadow-2xl space-y-4">
        <h2 className="text-xl font-bold text-gray-800 text-center">Staff Sign In</h2>
        <input type="email" placeholder="Staff Email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
        <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
        <button type="submit" disabled={busy}
          className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
