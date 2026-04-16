import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Cell: () => null,
}));

describe('Ops Dashboard App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard header', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<App />);

    expect(screen.getByText('SmartVenue AI')).toBeInTheDocument();
    expect(screen.getByText(/Operations Command Centre/i)).toBeInTheDocument();
  });

  it('displays KPI cards in overview tab', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<App />);

    expect(screen.getByText('Critical Zones')).toBeInTheDocument();
    expect(screen.getByText('People in Queue')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('Staff On Duty')).toBeInTheDocument();
  });

  it('renders tab navigation', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<App />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Zones')).toBeInTheDocument();
    expect(screen.getByText('Queues')).toBeInTheDocument();
    expect(screen.getByText(/Alerts/i)).toBeInTheDocument();
    expect(screen.getByText('Broadcast')).toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Zones'));

    expect(screen.getByText('All Zones — Live Status')).toBeInTheDocument();
  });

  it('displays zone data', async () => {
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
                densityScore: 0.65,
                occupancyCount: 300,
              }),
            },
          ],
        });
      } else {
        callback({ docs: [] });
      }
      return () => {};
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('North Stand')).toBeInTheDocument();
    });
  });

  it('shows queue depths', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path && ref.path.includes('queues')) {
        callback({
          docs: [
            {
              id: 'queue-1',
              data: () => ({
                amenityId: 'Restroom',
                length: 15,
                avgWaitMins: 8,
              }),
            },
          ],
        });
      } else {
        callback({ docs: [] });
      }
      return () => {};
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Queues'));

    await waitFor(() => {
      expect(screen.getByText('Restroom')).toBeInTheDocument();
      expect(screen.getByText('15 waiting')).toBeInTheDocument();
    });
  });

  it('displays emergency broadcast section', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Broadcast'));

    expect(screen.getByText(/Emergency Broadcast/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type emergency message/i)).toBeInTheDocument();
  });

  it('sends emergency broadcast', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;

    axios.post.mockResolvedValueOnce({ data: { success: true } });

    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Broadcast'));

    const textarea = screen.getByPlaceholderText(/Type emergency message/i);
    await user.type(textarea, 'All staff proceed to exit routes');

    const sendButton = screen.getByRole('button', { name: /SEND EMERGENCY BROADCAST/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/notify/emergency'),
        expect.objectContaining({
          message: 'All staff proceed to exit routes',
        })
      );
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('displays alerts when present', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path && ref.path.includes('alerts')) {
        callback({
          docs: [
            {
              id: 'alert-1',
              data: () => ({
                message: 'High density detected',
                zoneId: 'zone-1',
                severity: 'red',
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

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('High density detected')).toBeInTheDocument();
    });
  });

  it('renders live status indicator', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<App />);

    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('has AI prediction button', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<App />);

    expect(screen.getByRole('button', { name: /Run AI Prediction/i })).toBeInTheDocument();
  });
});
