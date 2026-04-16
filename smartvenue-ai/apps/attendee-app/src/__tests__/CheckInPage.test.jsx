import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CheckInPage from '../pages/CheckInPage';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: vi.fn(async () => 'test-token-123'),
    },
  })),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CheckInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders check-in form', () => {
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    expect(screen.getByText('Gate Check-In')).toBeInTheDocument();
    expect(screen.getByText(/Enter your ticket details/i)).toBeInTheDocument();
  });

  it('displays gate selector dropdown', () => {
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    expect(screen.getByDisplayValue('GATE 3')).toBeInTheDocument();
  });

  it('displays ticket ID input field', () => {
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    expect(screen.getByPlaceholderText(/e.g. TKT-ABC12345/i)).toBeInTheDocument();
  });

  it('updates gate selection', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    const gateSelect = screen.getByDisplayValue('GATE 3');
    await user.selectOptions(gateSelect, 'gate-5');

    expect(gateSelect.value).toBe('gate-5');
  });

  it('updates ticket ID input', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    const ticketInput = screen.getByPlaceholderText(/e.g. TKT-ABC12345/i);
    await user.type(ticketInput, 'TKT-ABC12345');

    expect(ticketInput.value).toBe('TKT-ABC12345');
  });

  it('submits check-in form', async () => {
    const axios = require('axios').default;
    axios.post.mockResolvedValueOnce({ data: { success: true } });

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    await user.click(screen.getByRole('button', { name: /Check In/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/attendees/checkin'),
        expect.objectContaining({
          venueId: 'venue-001',
          gateId: 'gate-3',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });
  });

  it('shows success message on check-in', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;

    axios.post.mockResolvedValueOnce({ data: { success: true } });

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    await user.click(screen.getByRole('button', { name: /Check In/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Checked in! Welcome to the venue 🎉');
    });
  });

  it('shows error message on check-in failure', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;

    axios.post.mockRejectedValueOnce(new Error('Check-in failed'));

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    await user.click(screen.getByRole('button', { name: /Check In/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('disables button while checking in', async () => {
    const axios = require('axios').default;
    axios.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /Check In/i });
    await user.click(button);

    const checkingButton = screen.getByRole('button', { name: /Checking in/i });
    expect(checkingButton).toBeDisabled();
  });

  it('includes ticket ID in request when provided', async () => {
    const axios = require('axios').default;
    axios.post.mockResolvedValueOnce({ data: { success: true } });

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <CheckInPage venueId="venue-001" />
      </BrowserRouter>
    );

    await user.type(screen.getByPlaceholderText(/TKT-ABC12345/i), 'TKT-XYZ789');
    await user.selectOptions(screen.getByDisplayValue('GATE 3'), 'gate-7');
    await user.click(screen.getByRole('button', { name: /Check In/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ticketId: 'TKT-XYZ789',
          gateId: 'gate-7',
        }),
        expect.any(Object)
      );
    });
  });
});
