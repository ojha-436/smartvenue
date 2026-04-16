import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Map, ClipboardList, AlertTriangle, LogOut } from 'lucide-react';

// Code-split page components for better performance
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ZonePage = React.lazy(() => import('./pages/ZonePage'));
const TasksPage = React.lazy(() => import('./pages/TasksPage'));
const IncidentPage = React.lazy(() => import('./pages/IncidentPage'));

/**
 * Loading skeleton component shown while pages are being loaded
 */
function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="space-y-4 w-full max-w-md p-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-40 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-40 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  );
}

/**
 * Navigation component with accessible landmark
 * Uses role="navigation" and proper semantic structure
 */
function Nav({ onLogout }) {
  const loc = useLocation();

  const tabs = useMemo(() => [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/zones', icon: Map, label: 'Zones' },
    { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
    { to: '/incident', icon: AlertTriangle, label: 'Incident' },
  ], []);

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex" role="navigation" aria-label="Main navigation">
      {tabs.map(({ to, icon: Icon, label }) => (
        <Link
          key={to}
          to={to}
          className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors
            ${loc.pathname === to ? 'text-green-600 font-semibold' : 'text-gray-400'}`}
          aria-current={loc.pathname === to ? 'page' : undefined}
        >
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
      <button
        onClick={onLogout}
        className="flex-1 flex flex-col items-center py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Sign out"
      >
        <LogOut size={20} aria-hidden="true" />
        <span>Out</span>
      </button>
    </nav>
  );
}

/**
 * SmartVenue Staff App
 * Main application component with authentication and route management
 */
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('staff_token'));
  const [staff, setStaff] = useState(JSON.parse(localStorage.getItem('staff_info') || 'null'));
  const VENUE_ID = import.meta.env.VITE_VENUE_ID || 'venue-001';

  /**
   * Handle staff login and store authentication tokens
   * @param {string} token - JWT authentication token
   * @param {Object} info - Staff information object
   */
  const handleLogin = (token, info) => {
    localStorage.setItem('staff_token', token);
    localStorage.setItem('staff_info', JSON.stringify(info));
    setToken(token);
    setStaff(info);
  };

  /**
   * Handle staff logout and clear stored data
   */
  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_info');
    setToken(null);
    setStaff(null);
  };

  const staffDisplayInfo = useMemo(() => ({
    name: staff?.displayName || 'Staff',
    role: staff?.role || 'Member',
  }), [staff]);

  return (
    <>
      <Toaster position="top-center" />
      <div className="max-w-md mx-auto min-h-screen">
        {/* Skip to main content link for accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:bg-blue-600 focus:text-white focus:p-2 focus:z-50">
          Skip to main content
        </a>

        {!token ? (
          <Suspense fallback={<LoadingSkeleton />}>
            <LoginPage onLogin={handleLogin} venueId={VENUE_ID} />
          </Suspense>
        ) : (
          <>
            {/* Staff header with semantic structure */}
            <header className="bg-green-700 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-200">Staff Portal</p>
                <h1 className="font-semibold text-sm">
                  {staffDisplayInfo.name} · {staffDisplayInfo.role}
                </h1>
              </div>
              <span className="text-xs bg-green-600 px-2 py-1 rounded-lg">{VENUE_ID}</span>
            </header>

            <main id="main-content" className="pb-20">
              <Suspense fallback={<LoadingSkeleton />}>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage token={token} venueId={VENUE_ID} staff={staff} />} />
                  <Route path="/zones" element={<ZonePage token={token} venueId={VENUE_ID} staff={staff} />} />
                  <Route path="/tasks" element={<TasksPage token={token} venueId={VENUE_ID} staff={staff} />} />
                  <Route path="/incident" element={<IncidentPage token={token} venueId={VENUE_ID} staff={staff} />} />
                  <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
              </Suspense>
            </main>

            <Nav onLogout={handleLogout} />
          </>
        )}
      </div>
    </>
  );
}
