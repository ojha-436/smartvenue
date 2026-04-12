import React, { useState } from 'react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, googleAuth } from '../firebase';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [mode,  setMode]  = useState('login');
  const [busy,  setBusy]  = useState(false);

  const signInGoogle = async () => {
    setBusy(true);
    try { await signInWithPopup(auth, googleAuth); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const signInEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        await createUserWithEmailAndPassword(auth, email, pass);
      }
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-gradient-to-br from-blue-700 to-blue-900">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">SmartVenue</h1>
        <p className="text-blue-200 mt-2">Your intelligent stadium companion</p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-800 mb-5 text-center" aria-live="polite">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h2>

        <button onClick={signInGoogle} disabled={busy} aria-busy={busy}
          className="w-full flex items-center justify-center gap-3 border border-gray-200
            rounded-xl py-3 font-medium text-gray-700 hover:bg-gray-50 mb-4 transition-colors">
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Added aria-hidden to the decorative divider */}
        <div className="flex items-center gap-3 my-4" aria-hidden="true">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={signInEmail} className="space-y-3">
          {/* Properly labeled Email input */}
          <div>
            <label htmlFor="emailInput" className="sr-only">Email Address</label>
            <input id="emailInput" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required aria-required="true" />
          </div>
          
          {/* Properly labeled Password input */}
          <div>
            <label htmlFor="passwordInput" className="sr-only">Password</label>
            <input id="passwordInput" type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required aria-required="true" />
          </div>

          <button type="submit" disabled={busy} aria-live="polite" aria-busy={busy}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button onClick={() => setMode(m => m === 'login' ? 'signup' : 'login')}
          className="w-full text-center text-sm text-blue-600 mt-4 hover:underline" aria-live="polite">
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
