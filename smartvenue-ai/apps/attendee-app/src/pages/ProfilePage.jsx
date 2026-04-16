/**
 * ProfilePage - User profile and preferences
 * Manage display name, GPS sharing, notifications, and account settings
 */

import React, { useEffect, useState, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { LogOut, MapPin, Bell, Shield } from 'lucide-react';
import { useApi } from '../shared/hooks/useApi';

/**
 * ProfilePage component - User profile and preferences
 */
export default function ProfilePage({ user }) {
  const [profile, setProfile] = useState({
    displayName: '',
    gpsOptIn: false,
    notifications: true,
  });
  const [saving, setSaving] = useState(false);

  // API hook for profile updates
  const { execute: executeProfileUpdate } = useApi(null, {
    method: 'PUT',
    client: 'attendee',
  });

  /**
   * Load user profile from Firestore on mount
   */
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const docRef = doc(db, 'attendees', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile((p) => ({
            ...p,
            ...data,
            ...(data.preferences && data.preferences),
          }));
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };
    loadProfile();
  }, [user.uid]);

  /**
   * Save profile preferences
   */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'attendees', user.uid),
        {
          displayName: profile.displayName || user.displayName,
          email: user.email,
          preferences: {
            gpsOptIn: profile.gpsOptIn,
            notifications: profile.notifications,
          },
        },
        { merge: true }
      );
      toast.success('Profile saved!');
    } catch (err) {
      toast.error('Could not save profile.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [profile, user.uid, user.displayName, user.email]);

  /**
   * Handle toggle switch for GPS opt-in
   */
  const toggleGPS = useCallback(() => {
    setProfile((p) => ({ ...p, gpsOptIn: !p.gpsOptIn }));
  }, []);

  /**
   * Handle toggle switch for notifications
   */
  const toggleNotifications = useCallback(() => {
    setProfile((p) => ({ ...p, notifications: !p.notifications }));
  }, []);

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white px-4 pt-12 pb-10">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-3">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
          <h1 className="text-xl font-bold">{user.displayName || 'Fan'}</h1>
          <p className="text-purple-200 text-sm">{user.email}</p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">Preferences</h3>

          {/* GPS Location Sharing Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <MapPin size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800">GPS Location Sharing</p>
                <p className="text-xs text-gray-500">Helps improve crowd density accuracy</p>
              </div>
            </div>
            <button
              onClick={toggleGPS}
              role="switch"
              aria-checked={profile.gpsOptIn}
              aria-label="Toggle GPS location sharing"
              className={`relative w-12 h-6 rounded-full transition-colors ${
                profile.gpsOptIn ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  profile.gpsOptIn ? 'translate-x-6' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Push Notifications Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
                <Bell size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800">Push Notifications</p>
                <p className="text-xs text-gray-500">Queue alerts and venue updates</p>
              </div>
            </div>
            <button
              onClick={toggleNotifications}
              role="switch"
              aria-checked={profile.notifications}
              aria-label="Toggle push notifications"
              className={`relative w-12 h-6 rounded-full transition-colors ${
                profile.notifications ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  profile.notifications ? 'translate-x-6' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-2xl py-3.5 font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Shield size={14} /> Your data is private
          </div>
          <p className="text-xs text-gray-400">
            GPS data is anonymised to zone-level precision before storage. We never store your
            exact location. You can delete your account data at any time.
          </p>
        </div>

        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600
            rounded-2xl py-3.5 font-semibold hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}
