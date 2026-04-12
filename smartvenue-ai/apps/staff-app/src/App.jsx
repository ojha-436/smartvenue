import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Map, ClipboardList, AlertTriangle, LogOut } from 'lucide-react';

import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ZonePage      from './pages/ZonePage';
import TasksPage     from './pages/TasksPage';
import IncidentPage  from './pages/IncidentPage';

function Nav({ onLogout }) {
  const loc = useLocation();
  const tabs = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/zones',     icon: Map,              label: 'Zones'     },
    { to: '/tasks',     icon: ClipboardList,    label: 'Tasks'     },
    { to: '/incident',  icon: AlertTriangle,    label: 'Incident'  },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex">
      {tabs.map(({ to, icon: Icon, label }) => (
        <Link key={to} to={to} className={`flex-1 flex flex-col items-center py-2 text-xs
          ${loc.pathname === to ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
          <Icon size={20} />
          {label}
        </Link>
      ))}
      <button onClick={onLogout} className="flex-1 flex flex-col items-center py-2 text-xs text-gray-400">
        <LogOut size={20} /> Out
      </button>
    </nav>
  );
}

export default function App() {
  const [token,  setToken]  = useState(localStorage.getItem('staff_token'));
  const [staff,  setStaff]  = useState(JSON.parse(localStorage.getItem('staff_info') || 'null'));
  const VENUE_ID = import.meta.env.VITE_VENUE_ID || 'venue-001';

  const handleLogin = (token, info) => {
    localStorage.setItem('staff_token', token);
    localStorage.setItem('staff_info',  JSON.stringify(info));
    setToken(token);
    setStaff(info);
  };

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_info');
    setToken(null);
    setStaff(null);
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className="max-w-md mx-auto min-h-screen">
        {!token ? (
          <LoginPage onLogin={handleLogin} venueId={VENUE_ID} />
        ) : (
          <>
            {/* Staff header */}
            <div className="bg-green-700 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-200">Staff Portal</p>
                <p className="font-semibold text-sm">{staff?.displayName || 'Staff'} · {staff?.role}</p>
              </div>
              <span className="text-xs bg-green-600 px-2 py-1 rounded-lg">{VENUE_ID}</span>
            </div>

            <div className="pb-20">
              <Routes>
                <Route path="/dashboard" element={<DashboardPage token={token} venueId={VENUE_ID} staff={staff} />} />
                <Route path="/zones"     element={<ZonePage     token={token} venueId={VENUE_ID} staff={staff} />} />
                <Route path="/tasks"     element={<TasksPage    token={token} venueId={VENUE_ID} staff={staff} />} />
                <Route path="/incident"  element={<IncidentPage token={token} venueId={VENUE_ID} staff={staff} />} />
                <Route path="*"          element={<Navigate to="/dashboard" />} />
              </Routes>
            </div>

            <Nav onLogout={handleLogout} />
          </>
        )}
      </div>
    </>
  );
}
