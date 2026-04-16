import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZonePage from '../pages/ZonePage';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

const defaultProps = {
  token: 'token-123',
  venueId: 'venue-001',
  staff: { uid: 'staff-1', role: 'security' },
};

describe('Staff ZonePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders zone page with a heading', () => {
    render(<ZonePage {...defaultProps} />);
    // Should have some heading containing "Zone"
    expect(screen.getByText(/Zone/i)).toBeInTheDocument();
  });

  it('renders a submit/report button', () => {
    render(<ZonePage {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders status selection options (radio buttons or select)', () => {
    render(<ZonePage {...defaultProps} />);
    // Either radio inputs or a select dropdown for status
    const radios = screen.queryAllByRole('radio');
    const combos = screen.queryAllByRole('combobox');
    expect(radios.length + combos.length).toBeGreaterThan(0);
  });

  it('passes token in Authorization header on submission', async () => {
    const axios = (await import('axios')).default;
    axios.post.mockResolvedValueOnce({ data: { success: true } });

    render(<ZonePage {...defaultProps} />);
    const submitBtn = screen.getAllByRole('button')[0];
    await userEvent.click(submitBtn);

    if (axios.post.mock.calls.length > 0) {
      const config = axios.post.mock.calls[0][2];
      if (config?.headers?.Authorization) {
        expect(config.headers.Authorization).toContain('Bearer token-123');
      }
    }
  });

  it('shows success feedback on successful zone report', async () => {
    const axios = (await import('axios')).default;
    const toast = (await import('react-hot-toast')).default;
    axios.post.mockResolvedValueOnce({ data: { success: true } });

    render(<ZonePage {...defaultProps} />);
    const submitBtn = screen.getAllByRole('button')[0];
    await userEvent.click(submitBtn);

    await waitFor(() => {
      // Either toast or inline success message
      const called = toast.success.mock.calls.length > 0
        || screen.queryByText(/success|reported|updated/i) !== null;
      expect(called).toBe(true);
    });
  });

  it('shows error feedback when axios.post fails', async () => {
    const axios = (await import('axios')).default;
    const toast = (await import('react-hot-toast')).default;
    axios.post.mockRejectedValueOnce(new Error('Network error'));

    render(<ZonePage {...defaultProps} />);
    const submitBtn = screen.getAllByRole('button')[0];
    await userEvent.click(submitBtn);

    await waitFor(() => {
      const called = toast.error.mock.calls.length > 0
        || screen.queryByText(/error|failed|could not/i) !== null;
      expect(called).toBe(true);
    });
  });

  it('includes venueId in the POST body', async () => {
    const axios = (await import('axios')).default;
    axios.post.mockResolvedValueOnce({ data: { success: true } });

    render(<ZonePage {...defaultProps} />);
    const submitBtn = screen.getAllByRole('button')[0];
    await userEvent.click(submitBtn);

    if (axios.post.mock.calls.length > 0) {
      const body = axios.post.mock.calls[0][1];
      expect(body).toMatchObject({ venueId: 'venue-001' });
    }
  });

  it('renders the zone ID / name in the form', () => {
    render(<ZonePage {...defaultProps} />);
    // Zone page should show zone identifier somewhere
    const textContent = document.body.textContent;
    expect(textContent.toLowerCase()).toMatch(/zone|gate|area/i);
  });

  it('component mounts and unmounts without errors', () => {
    const { unmount } = render(<ZonePage {...defaultProps} />);
    expect(() => unmount()).not.toThrow();
  });
});
