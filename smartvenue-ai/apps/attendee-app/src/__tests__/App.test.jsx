import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Start unsubscribed - simulate pending auth state
    return () => {};
  }),
}));

// Mock ErrorBoundary
vi.mock('../components/ErrorBoundary', () => ({
  default: ({ children }) => children,
}));

// Mock lazy-loaded pages
vi.mock('../pages/LoginPage', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock('../pages/HomePage', () => ({
  default: () => <div data-testid="home-page">Home Page</div>,
}));

vi.mock('../pages/VenueMapPage', () => ({
  default: () => <div data-testid="venue-map-page">Venue Map</div>,
}));

vi.mock('../pages/QueuePage', () => ({
  default: () => <div data-testid="queue-page">Queue Page</div>,
}));

vi.mock('../pages/OrderPage', () => ({
  default: () => <div data-testid="order-page">Order Page</div>,
}));

vi.mock('../pages/ProfilePage', () => ({
  default: () => <div data-testid="profile-page">Profile Page</div>,
}));

vi.mock('../pages/CheckInPage', () => ({
  default: () => <div data-testid="checkin-page">Check-In Page</div>,
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
}));

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders loading state while checking auth', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    const loader = screen.getByRole('presentation');
    expect(loader).toBeInTheDocument();
  });

  it('shows login page when user is not authenticated', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return () => {};
    });

    render(
      <BrowserRouter initialEntries={['/login']}>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('redirects to /home when user is authenticated', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      return () => {};
    });

    render(
      <BrowserRouter initialEntries={['/']}>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
  });

  it('shows protected route content when user is authenticated', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      return () => {};
    });

    render(
      <BrowserRouter initialEntries={['/queue']}>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('queue-page')).toBeInTheDocument();
    });
  });

  it('unsubscribes from auth listener on unmount', async () => {
    const mockUnsubscribe = vi.fn();
    const { onAuthStateChanged } = await import('firebase/auth');
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return mockUnsubscribe;
    });

    const { unmount } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('renders navbar when user is authenticated', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({
        uid: 'test-user-123',
        email: 'test@example.com',
      });
      return () => {};
    });

    render(
      <BrowserRouter initialEntries={['/home']}>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      const nav = screen.getByRole('navigation', { hidden: true });
      expect(nav).toBeInTheDocument();
    });
  });

  it('hides navbar when user is not authenticated', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return () => {};
    });

    render(
      <BrowserRouter initialEntries={['/login']}>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      const navs = screen.queryAllByRole('navigation');
      expect(navs.length).toBe(0);
    });
  });
});
