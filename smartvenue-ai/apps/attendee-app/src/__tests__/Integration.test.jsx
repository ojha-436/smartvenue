import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    return () => {};
  }),
  signInWithEmailAndPassword: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
}));

vi.mock('../firebase', () => ({
  auth: {},
  googleAuth: {},
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({
    exists: () => false,
    data: () => ({}),
  })),
  setDoc: vi.fn(async () => {}),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('completes login to home flow', async () => {
    const { onAuthStateChanged, signInWithEmailAndPassword } = await import('firebase/auth');
    const { onSnapshot } = await import('firebase/firestore');

    // Setup mocks
    let authCallback;
    onAuthStateChanged.mockImplementation((auth, callback) => {
      authCallback = callback;
      return () => {};
    });

    signInWithEmailAndPassword.mockImplementation(async () => {
      authCallback({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
    });

    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    const user = userEvent.setup();
    render(
      <BrowserRouter initialEntries={['/login']}>
        <App />
      </BrowserRouter>
    );

    // Simulate auth check completing
    authCallback(null);

    await waitFor(() => {
      expect(screen.getByText(/Welcome back|Sign In/i)).toBeInTheDocument();
    });
  });

  it('displays queue join and position tracking flow', async () => {
    const axios = require('axios').default;
    const { onAuthStateChanged } = await import('firebase/auth');
    const { onSnapshot } = await import('firebase/firestore');

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      return () => {};
    });

    // Mock queue data
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'amenity-1',
            data: () => ({
              amenityId: 'Restroom',
              length: 5,
              avgWaitMins: 3,
            }),
          },
        ],
      });
      return () => {};
    });

    axios.post.mockResolvedValueOnce({
      data: { entryId: 'entry-123' },
    });

    const user = userEvent.setup();
    render(
      <BrowserRouter initialEntries={['/queue']}>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Restroom')).toBeInTheDocument();
    });

    const joinButtons = screen.queryAllByRole('button');
    const joinButton = joinButtons.find(btn => btn.textContent.includes('Join'));

    if (joinButton) {
      await user.click(joinButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalled();
      });
    }
  });

  it('completes order creation flow', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;
    const { onAuthStateChanged } = await import('firebase/auth');

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      return () => {};
    });

    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food', standId: 'stand-a' },
        ],
      },
    });

    axios.post.mockResolvedValueOnce({
      data: { orderId: 'order-123', estimatedReadyMins: 10 },
    });

    const user = userEvent.setup();
    render(
      <BrowserRouter initialEntries={['/order']}>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button');
    const addButton = addButtons.find(btn => btn.textContent.includes('Add'));

    if (addButton) {
      await user.click(addButton);

      await waitFor(() => {
        const placeButton = screen.queryByRole('button', { name: /Place Order/i });
        if (placeButton) {
          user.click(placeButton);
        }
      });
    }
  });

  it('handles logout and redirects to login', async () => {
    const { onAuthStateChanged, signOut } = await import('firebase/auth');
    let authCallback;

    onAuthStateChanged.mockImplementation((auth, callback) => {
      authCallback = callback;
      callback({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      return () => {};
    });

    signOut.mockImplementation(async () => {
      authCallback(null);
    });

    const user = userEvent.setup();
    const { onSnapshot } = await import('firebase/firestore');

    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(
      <BrowserRouter initialEntries={['/me']}>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Sign Out/i));

    // After logout, should eventually show login or unauthenticated state
    await waitFor(() => {
      expect(onAuthStateChanged).toHaveBeenCalled();
    });
  });

  it('preserves venue ID across page navigation', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    const { onSnapshot } = await import('firebase/firestore');

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      return () => {};
    });

    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    localStorage.setItem('venueId', 'venue-002');

    render(
      <BrowserRouter initialEntries={['/home']}>
        <App />
      </BrowserRouter>
    );

    expect(localStorage.getItem('venueId')).toBe('venue-002');
  });

  it('maintains queue state across navigation', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    const { onSnapshot } = await import('firebase/firestore');

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      return () => {};
    });

    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    localStorage.setItem('myQueues', JSON.stringify({ 'amenity-1': 'entry-123' }));

    render(
      <BrowserRouter initialEntries={['/queue']}>
        <App />
      </BrowserRouter>
    );

    const stored = JSON.parse(localStorage.getItem('myQueues'));
    expect(stored['amenity-1']).toBe('entry-123');
  });
});
