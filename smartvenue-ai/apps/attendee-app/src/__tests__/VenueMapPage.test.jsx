import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VenueMapPage from '../pages/VenueMapPage';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(),
}));

describe('VenueMapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders venue map header', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<VenueMapPage venueId="venue-001" />);

    expect(screen.getByText('Venue Map')).toBeInTheDocument();
    expect(screen.getByText(/Live crowd density/i)).toBeInTheDocument();
  });

  it('displays legend with status colors', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<VenueMapPage venueId="venue-001" />);

    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('Busy')).toBeInTheDocument();
    expect(screen.getByText('Crowded')).toBeInTheDocument();
  });

  it('renders zone grid with placeholder when no data', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<VenueMapPage venueId="venue-001" />);

    // Should show placeholder skeleton loaders
    expect(screen.getByText('STADIUM OVERVIEW')).toBeInTheDocument();
  });

  it('renders zone buttons when data loaded', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'north-stand',
            data: () => ({
              name: 'North Stand',
              status: 'clear',
              densityScore: 0.3,
              occupancyCount: 150,
            }),
          },
          {
            id: 'south-gate',
            data: () => ({
              name: 'South Gate',
              status: 'critical',
              densityScore: 0.95,
              occupancyCount: 500,
            }),
          },
        ],
      });
      return () => {};
    });

    render(<VenueMapPage venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('North Stand')).toBeInTheDocument();
      expect(screen.getByText('South Gate')).toBeInTheDocument();
    });
  });

  it('displays density percentage on zone button', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'zone-1',
            data: () => ({
              name: 'Zone A',
              status: 'busy',
              densityScore: 0.65,
              occupancyCount: 200,
            }),
          },
        ],
      });
      return () => {};
    });

    render(<VenueMapPage venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('65%')).toBeInTheDocument();
    });
  });

  it('selects and displays zone details', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'zone-1',
            data: () => ({
              name: 'VIP Lounge',
              status: 'clear',
              densityScore: 0.2,
              occupancyCount: 50,
              predictedDensity15Min: 0.35,
            }),
          },
        ],
      });
      return () => {};
    });

    const user = userEvent.setup();
    render(<VenueMapPage venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('VIP Lounge')).toBeInTheDocument();
    });

    const zoneButton = screen.getByRole('button', { name: /VIP Lounge/i });
    await user.click(zoneButton);

    expect(screen.getByText(/Occupancy: 50 people/i)).toBeInTheDocument();
  });

  it('shows predicted density in zone detail card', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'zone-1',
            data: () => ({
              name: 'East Gate',
              status: 'busy',
              densityScore: 0.55,
              occupancyCount: 250,
              predictedDensity15Min: 0.75,
            }),
          },
        ],
      });
      return () => {};
    });

    const user = userEvent.setup();
    render(<VenueMapPage venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('East Gate')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /East Gate/i }));

    await waitFor(() => {
      expect(screen.getByText(/Predicted in 15 min: 75%/i)).toBeInTheDocument();
    });
  });

  it('displays critical warning when zone status is critical', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'zone-1',
            data: () => ({
              name: 'Packed Area',
              status: 'critical',
              densityScore: 0.9,
              occupancyCount: 450,
            }),
          },
        ],
      });
      return () => {};
    });

    const user = userEvent.setup();
    render(<VenueMapPage venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Packed Area')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Packed Area/i }));

    await waitFor(() => {
      expect(screen.getByText(/This area is very crowded/i)).toBeInTheDocument();
    });
  });

  it('deselects zone when clicking same zone again', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'zone-1',
            data: () => ({
              name: 'Zone A',
              status: 'clear',
              densityScore: 0.2,
              occupancyCount: 80,
            }),
          },
        ],
      });
      return () => {};
    });

    const user = userEvent.setup();
    render(<VenueMapPage venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Zone A')).toBeInTheDocument();
    });

    const zoneButton = screen.getByRole('button', { name: /Zone A/i });
    await user.click(zoneButton);

    await waitFor(() => {
      expect(screen.getByText(/Occupancy: 80 people/i)).toBeInTheDocument();
    });

    await user.click(zoneButton);

    expect(screen.queryByText(/Occupancy: 80 people/i)).not.toBeInTheDocument();
  });

  it('unsubscribes from listener on unmount', () => {
    const { onSnapshot } = require('firebase/firestore');
    const mockUnsubscribe = vi.fn();
    onSnapshot.mockReturnValue(mockUnsubscribe);

    const { unmount } = render(<VenueMapPage venueId="venue-001" />);

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('updates when venueId prop changes', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    const { rerender } = render(<VenueMapPage venueId="venue-001" />);

    rerender(<VenueMapPage venueId="venue-002" />);

    expect(onSnapshot).toHaveBeenCalled();
  });
});
