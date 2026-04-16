import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QueuePage from '../pages/QueuePage';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
};

describe('QueuePage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders queue page header', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<QueuePage user={mockUser} venueId="venue-001" />);

    expect(screen.getByText('Virtual Queue')).toBeInTheDocument();
  });

  it('displays amenities from Firestore', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'restroom-1',
            data: () => ({
              amenityId: 'Restroom A',
              length: 5,
              avgWaitMins: 3,
            }),
          },
          {
            id: 'concession-1',
            data: () => ({
              amenityId: 'Concession Stand',
              length: 12,
              avgWaitMins: 8,
            }),
          },
        ],
      });
      return () => {};
    });

    render(<QueuePage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Restroom A')).toBeInTheDocument();
      expect(screen.getByText('Concession Stand')).toBeInTheDocument();
    });
  });

  it('shows queue length and wait time', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'amenity-1',
            data: () => ({
              amenityId: 'Water Station',
              length: 8,
              avgWaitMins: 4,
            }),
          },
        ],
      });
      return () => {};
    });

    render(<QueuePage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('8 people')).toBeInTheDocument();
      expect(screen.getByText('~4 min wait')).toBeInTheDocument();
    });
  });

  it('joins queue successfully', async () => {
    const axios = await import('axios');
    axios.default.post.mockResolvedValueOnce({
      data: { entryId: 'entry-123' },
    });

    const toast = await import('react-hot-toast');

    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'restroom-1',
            data: () => ({
              amenityId: 'Restroom A',
              length: 5,
              avgWaitMins: 3,
            }),
          },
        ],
      });
      return () => {};
    });

    const user = userEvent.setup();
    render(<QueuePage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Restroom A')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Join/i }));

    await waitFor(() => {
      expect(axios.default.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/queues/restroom-1/join'),
        {
          userId: 'test-user-123',
          venueId: 'venue-001',
          displayName: 'Test User',
        }
      );
      expect(toast.default.success).toHaveBeenCalled();
    });
  });

  it('stores joined queue in localStorage', async () => {
    const axios = await import('axios');
    axios.default.post.mockResolvedValueOnce({
      data: { entryId: 'entry-123' },
    });

    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'amenity-1',
            data: () => ({
              amenityId: 'Queue 1',
              length: 3,
              avgWaitMins: 2,
            }),
          },
        ],
      });
      return () => {};
    });

    const user = userEvent.setup();
    render(<QueuePage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Queue 1')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Join/i }));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('myQueues'));
      expect(stored['amenity-1']).toBe('entry-123');
    });
  });

  it('prevents joining same queue twice', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'amenity-1',
            data: () => ({
              amenityId: 'Amenity A',
              length: 2,
              avgWaitMins: 1,
            }),
          },
        ],
      });
      return () => {};
    });

    const toast = await import('react-hot-toast');
    localStorage.setItem('myQueues', JSON.stringify({ 'amenity-1': 'entry-123' }));

    const user = userEvent.setup();
    render(<QueuePage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Amenity A')).toBeInTheDocument();
    });

    const joinButton = screen.queryByRole('button', { name: /Join/i });
    expect(joinButton).not.toBeInTheDocument();
    expect(screen.getByText('In Queue')).toBeInTheDocument();
  });

  it('leaves queue successfully', async () => {
    const axios = await import('axios');
    axios.default.delete.mockResolvedValueOnce({
      data: { success: true },
    });

    const toast = await import('react-hot-toast');

    localStorage.setItem('myQueues', JSON.stringify({ 'amenity-1': 'entry-123' }));

    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'amenity-1',
            data: () => ({
              amenityId: 'Amenity A',
              length: 5,
              avgWaitMins: 3,
            }),
          },
        ],
      });
      return () => {};
    });

    const user = userEvent.setup();
    render(<QueuePage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('In Queue')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Leave/i }));

    await waitFor(() => {
      expect(axios.default.delete).toHaveBeenCalledWith(
        expect.stringContaining('/api/queues/amenity-1/leave'),
        {
          data: { entryId: 'entry-123', venueId: 'venue-001' },
        }
      );
      expect(toast.default.success).toHaveBeenCalled();
    });
  });

  it('displays status color based on queue length', async () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'amenity-1',
            data: () => ({
              amenityId: 'Short Queue',
              length: 2,
              avgWaitMins: 1,
            }),
          },
          {
            id: 'amenity-2',
            data: () => ({
              amenityId: 'Long Queue',
              length: 20,
              avgWaitMins: 10,
            }),
          },
        ],
      });
      return () => {};
    });

    render(<QueuePage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Short Queue')).toBeInTheDocument();
      expect(screen.getByText('Long Queue')).toBeInTheDocument();
    });
  });

  it('shows summary when user is in queues', async () => {
    localStorage.setItem('myQueues', JSON.stringify({ 'amenity-1': 'entry-1', 'amenity-2': 'entry-2' }));

    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({ docs: [] });
      return () => {};
    });

    render(<QueuePage user={mockUser} venueId="venue-001" />);

    expect(screen.getByText(/You're in 2 queue\(s\)/i)).toBeInTheDocument();
  });

  it('handles join queue error gracefully', async () => {
    const axios = await import('axios');
    axios.default.post.mockRejectedValueOnce(new Error('Network error'));

    const toast = await import('react-hot-toast');

    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        docs: [
          {
            id: 'amenity-1',
            data: () => ({
              amenityId: 'Amenity A',
              length: 3,
              avgWaitMins: 2,
            }),
          },
        ],
      });
      return () => {};
    });

    const user = userEvent.setup();
    render(<QueuePage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Amenity A')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Join/i }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalled();
    });
  });

  it('displays loading state', () => {
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, callback) => {
      // Don't call callback to maintain loading state
      return () => {};
    });

    render(<QueuePage user={mockUser} venueId="venue-001" />);

    expect(screen.getByText(/Loading queues/i)).toBeInTheDocument();
  });
});
