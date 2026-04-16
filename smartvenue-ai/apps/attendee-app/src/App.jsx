/**
 * Main App component - Routes, authentication, and navigation
 * Implements error boundaries, accessibility features, and skip-to-content links
 */

import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { auth } from './firebase';
import { Home, Map, ShoppingCart, Users, User } from 'lucide-react';
import PropTypes from 'prop-types';
import ErrorBoundary from './components/ErrorBoundary';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const VenueMapPage = lazy(() => import('./pages/VenueMapPage'));
const QueuePage = lazy(() => import('./pages/QueuePage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CheckInPage = lazy(() => import('./pages/CheckInPage'));

/**
 * Navigation bar component for authenticated users
 * Provides accessible tab navigation to main sections
 */
function NavBar() {
  const location = useLocation();
  const tabs = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/map', icon: Map, label: 'Map' },
    { to: '/queue', icon: Users, label: 'Queue' },
    { to: '/order', icon: ShoppingCart, label: 'Order' },
    { to: '/me', icon: User, label: 'Me' },
  ];

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 safe-area-pb"
    >
      {tabs.map(({ to, icon: Icon, label }) => {
        const isActive = location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors
              ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}
          >
            <Icon size={22} aria-hidden="true" />
            <span className="mt-0.5">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Protected route wrapper that requires authentication
 * Redirects to login if user is not authenticated
 */
function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

ProtectedRoute.propTypes = {
  user: PropTypes.object,
  children: PropTypes.node.isRequired,
};

/**
 * Main App component
 * Manages authentication state and renders appropriate routes
 */
export default function App() {
  const [user, setUser] = useState(undefined);
  const [venueId, setVenueId] = useState(
    localStorage.getItem('venueId') || 'venue-001'
  );

  /**
   * Subscribe to Firebase auth state changes
   */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  /**
   * Loading state while checking authentication
   */
  if (user === undefined) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"
          aria-hidden="true"
        />
        <span className="sr-only">Loading application...</span>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" />

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <main className="max-w-md mx-auto min-h-screen relative" id="main-content">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
              </div>
            }
          >
            <Routes>
              <Route
                path="/login"
                element={
                  !user ? <LoginPage /> : <Navigate to="/home" />
                }
              />
              <Route
                path="/checkin"
                element={
                  <ProtectedRoute user={user}>
                    <CheckInPage venueId={venueId} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/home"
                element={
                  <ProtectedRoute user={user}>
                    <HomePage user={user} venueId={venueId} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/map"
                element={
                  <ProtectedRoute user={user}>
                    <VenueMapPage user={user} venueId={venueId} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/queue"
                element={
                  <ProtectedRoute user={user}>
                    <QueuePage user={user} venueId={venueId} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/order"
                element={
                  <ProtectedRoute user={user}>
                    <OrderPage user={user} venueId={venueId} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/me"
                element={
                  <ProtectedRoute user={user}>
                    <ProfilePage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="*"
                element={<Navigate to={user ? '/home' : '/login'} />}
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        {user && <NavBar />}
      </main>
    </>
  );
}
