import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { auth } from './firebase';
import { Home, Map, ShoppingCart, Users, User } from 'lucide-react';
import PropTypes from 'prop-types';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage    from './pages/LoginPage';
import HomePage     from './pages/HomePage';
import VenueMapPage from './pages/VenueMapPage';
import QueuePage    from './pages/QueuePage';
import OrderPage    from './pages/OrderPage';
import ProfilePage  from './pages/ProfilePage';
import CheckInPage  from './pages/CheckInPage';

function NavBar() {
  const loc = useLocation();
  const tabs = [
    { to: '/home',  icon: Home,         label: 'Home'   },
    { to: '/map',   icon: Map,          label: 'Map'    },
    { to: '/queue', icon: Users,        label: 'Queue'  },
    { to: '/order', icon: ShoppingCart, label: 'Order'  },
    { to: '/me',    icon: User,         label: 'Me'     },
  ];
  
  return (
    <nav aria-label="Main Navigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 safe-area-pb">
      {tabs.map(({ to, icon: Icon, label }) => {
        const isActive = loc.pathname.startsWith(to);
        return (
          <Link key={to} to={to}
            aria-current={isActive ? "page" : undefined}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors
              ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>
            <Icon size={22} aria-hidden="true" />
            <span className="mt-0.5">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
ProtectedRoute.propTypes = {
  user: PropTypes.object,
  children: PropTypes.node.isRequired,
};
ProtectedRoute.propTypes = {
  user: PropTypes.object,
  children: PropTypes.node.isRequired,
};
export default function App() {
  const [user,    setUser]    = useState(undefined);
  const [venueId, setVenueId] = useState(localStorage.getItem('venueId') || 'venue-001');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen" aria-live="polite" aria-busy="true">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" aria-hidden="true" />
        <span className="sr-only">Loading application...</span>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <main className="max-w-md mx-auto min-h-screen relative">
      <ErrorBoundary>
        <Routes>
          <Route path="/login"   element={!user ? <LoginPage /> : <Navigate to="/home" />} />
          <Route path="/checkin" element={<ProtectedRoute user={user}><CheckInPage venueId={venueId} /></ProtectedRoute>} />
          <Route path="/home"    element={<ProtectedRoute user={user}><HomePage user={user} venueId={venueId} /></ProtectedRoute>} />
          <Route path="/map"     element={<ProtectedRoute user={user}><VenueMapPage user={user} venueId={venueId} /></ProtectedRoute>} />
          <Route path="/queue"   element={<ProtectedRoute user={user}><QueuePage user={user} venueId={venueId} /></ProtectedRoute>} />
          <Route path="/order"   element={<ProtectedRoute user={user}><OrderPage user={user} venueId={venueId} /></ProtectedRoute>} />
          <Route path="/me"      element={<ProtectedRoute user={user}><ProfilePage user={user} /></ProtectedRoute>} />
          <Route path="*"        element={<Navigate to={user ? '/home' : '/login'} />} />
        </Routes>
        </ErrorBoundary>
        {user && <NavBar />}
      </main>
    </>
  );
}
