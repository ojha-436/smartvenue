import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../pages/DashboardPage';

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));

describe('Staff DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard header', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(
      <DashboardPage token="token-123" venueId="venue-001" staff={{ role: 'security' }} />
    );

    expect(screen.getByText('Live Overview')).toBeInTheDocument();
  });

  it('displays KPI cards', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(
      <DashboardPage token="token-123" venueId="venue-001" staff={{ role: 'security' }} />
    );

    expect(screen.getByText('Critical Zones')).toBeInTheDocument();
    expect(screen.getByText('In Queues')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
  });

  it('displays zone status cards', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path && ref.path.includes('zones')) {
        callback({
          docs: [
            {
              id: 'zone-1',
              data: () => ({
                name: 'North Stand',
                status: 'busy',
                occupancyCount: 200,
              }),
            },
          ],
        });
      } else if (ref.path && ref.path.includes('queues')) {
        callback({ docs: [] });
      } else if (ref.path && ref.path.includes('alerts')) {
        callback({ docs: [] });
      }
      return () => {};
    });

    render(
      <DashboardPage token="token-123" venueId="venue-001" staff={{ role: 'security' }} />
    );

    await waitFor(() => {
      expect(screen.getByText('North Stand')).toBeInTheDocument();
    });
  });

  it('displays queue summary', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path && ref.path.includes('queues')) {
        callback({
          docs: [
            {
              id: 'queue-1',
              data: () => ({
                amenityId: 'Restroom A',
                length: 12,
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
      <DashboardPage token="token-123" venueId="venue-001" staff={{ role: 'security' }} />
    );

    await waitFor(() => {
      expect(screen.getByText('Queue Depths')).toBeInTheDocument();
      expect(screen.getByText('Restroom A')).toBeInTheDocument();
      expect(screen.getByText('12 waiting')).toBeInTheDocument();
    });
  });

  it('shows alert count when alerts present', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path && ref.path.includes('alerts')) {
        callback({
          docs: [
            {
              id: 'alert-1',
              data: () => ({
                message: 'High crowd alert',
                zoneId: 'zone-1',
                severity: 'warning',
                acknowledged: false,
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
      <DashboardPage token="token-123" venueId="venue-001" staff={{ role: 'security' }} />
    );

    await waitFor(() => {
      expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    });
  });
});
