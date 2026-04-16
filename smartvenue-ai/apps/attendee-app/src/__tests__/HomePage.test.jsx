import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome header with user name', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('displays quick action buttons', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    expect(screen.getByText('Venue Map')).toBeInTheDocument();
    expect(screen.getByText('Join Queue')).toBeInTheDocument();
    expect(screen.getByText('Order Food')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('renders zone cards with live Firestore data', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path && ref.path.includes('zones')) {
        callback({
          docs: [
            {
              id: 'zone-1',
              data: () => ({
                name: 'North Stand',
                status: 'clear',
                occupancyCount: 50,
              }),
            },
            {
              id: 'zone-2',
              data: () => ({
                name: 'South Gate',
                status: 'busy',
                occupancyCount: 150,
              }),
            },
          ],
        });
      } else {
        callback({ docs: [] });
      }
      return () => {};
    });

    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('North Stand')).toBeInTheDocument();
      expect(screen.getByText('South Gate')).toBeInTheDocument();
    });
  });

  it('displays status badges correctly', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path && ref.path.includes('zones')) {
        callback({
          docs: [
            {
              id: 'zone-1',
              data: () => ({
                name: 'VIP Lounge',
                status: 'clear',
                occupancyCount: 10,
              }),
            },
          ],
        });
      } else {
        callback({ docs: [] });
      }
      return () => {};
    });

    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });
  });

  it('shows active alerts when present', async () => {
    const { onSnapshot } = require('firebase/firestore');
    const alertCallback = vi.fn();
    const zoneCallback = vi.fn();

    onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path && ref.path.includes('alerts')) {
        alertCallback(callback);
        callback({
          docs: [
            {
              id: 'alert-1',
              data: () => ({
                message: 'High crowd density near Gate 3',
                severity: 'warning',
              }),
            },
          ],
        });
      } else if (ref.path && ref.path.includes('zones')) {
        zoneCallback(callback);
        callback({ docs: [] });
      } else {
        callback({ docs: [] });
      }
      return () => {};
    });

    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Active Alerts')).toBeInTheDocument();
      expect(screen.getByText('High crowd density near Gate 3')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      // Don't call callback immediately to keep loading state
      return () => {};
    });

    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    expect(screen.getByText(/Loading crowd data/i)).toBeInTheDocument();
  });

  it('displays smart tip section', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    expect(screen.getByText(/Smart Tip/i)).toBeInTheDocument();
    expect(screen.getByText(/Gate 7 is currently clear/i)).toBeInTheDocument();
  });

  it('unsubscribes from Firestore listeners on unmount', async () => {
    const { onSnapshot } = require('firebase/firestore');
    const mockUnsubscribe = vi.fn();
    onSnapshot.mockReturnValue(mockUnsubscribe);

    const { unmount } = render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('updates when venueId prop changes', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    const { rerender } = render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );

    rerender(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-002" />
      </BrowserRouter>
    );

    expect(onSnapshot).toHaveBeenCalled();
  });
});
