import React, { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const STAFF_API = import.meta.env.VITE_STAFF_API;

/**
 * LoginPage - Staff authentication interface
 * Provides secure login form with email and password fields
 */
export default function LoginPage({ onLogin, venueId }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * Handle login form submission
   */
  const login = useCallback(
    async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        const res = await axios.post(`${STAFF_API}/api/staff/login`, {
          email,
          password,
          venueId,
        });
        onLogin(res.data.token, {
          email,
          role: res.data.role,
          displayName: res.data.displayName,
        });
        toast.success('Welcome back!');
      } catch {
        toast.error('Invalid credentials');
      } finally {
        setBusy(false);
      }
    },
    [email, password, venueId, onLogin]
  );

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-gradient-to-br from-green-700 to-green-900">
      {/* Skip link */}
      <a href="#login-form" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:bg-blue-600 focus:text-white focus:p-2 focus:z-50">
        Skip to login form
      </a>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">SmartVenue</h1>
        <p className="text-green-200 text-sm mt-1">Staff Portal</p>
      </div>

      {/* Login form */}
      <form
        id="login-form"
        onSubmit={login}
        className="bg-white rounded-3xl p-6 shadow-2xl space-y-4"
        aria-label="Staff login form"
      >
        <h2 className="text-xl font-bold text-gray-800 text-center">Staff Sign In</h2>

        {/* Email field */}
        <div>
          <label htmlFor="staff-email" className="sr-only">
            Staff Email
          </label>
          <input
            id="staff-email"
            type="email"
            placeholder="Staff Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            required
            aria-required="true"
            aria-label="Email address"
            autoComplete="email"
          />
        </div>

        {/* Password field */}
        <div>
          <label htmlFor="staff-password" className="sr-only">
            Password
          </label>
          <input
            id="staff-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            required
            aria-required="true"
            aria-label="Password"
            autoComplete="current-password"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          aria-busy={busy}
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        {/* Security notice */}
        <p className="text-xs text-gray-500 text-center">
          For venue: <span className="font-semibold">{venueId}</span>
        </p>
      </form>

      {/* Support information */}
      <p className="text-center text-green-200 text-xs mt-8 max-w-sm mx-auto">
        Staff accounts are securely managed by the venue operations team. Contact your manager if you need access assistance.
      </p>
    </div>
  );
}
