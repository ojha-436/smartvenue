import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../pages/LoginPage';

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
}));

describe('Staff LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form', () => {
    const mockOnLogin = vi.fn();
    render(<LoginPage onLogin={mockOnLogin} venueId="venue-001" />);

    expect(screen.getByText(/Staff Sign In/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Staff Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('updates email input', async () => {
    const mockOnLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} venueId="venue-001" />);

    const emailInput = screen.getByPlaceholderText('Staff Email');
    await user.type(emailInput, 'staff@example.com');

    expect(emailInput.value).toBe('staff@example.com');
  });

  it('updates password input', async () => {
    const mockOnLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} venueId="venue-001" />);

    const passwordInput = screen.getByPlaceholderText('Password');
    await user.type(passwordInput, 'password123');

    expect(passwordInput.value).toBe('password123');
  });

  it('submits login request', async () => {
    const axios = require('axios').default;
    axios.post.mockResolvedValueOnce({
      data: { token: 'token-123', role: 'security', displayName: 'John Doe' },
    });

    const mockOnLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} venueId="venue-001" />);

    await user.type(screen.getByPlaceholderText('Staff Email'), 'staff@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/staff/login'),
        expect.objectContaining({
          email: 'staff@example.com',
          password: 'password123',
          venueId: 'venue-001',
        })
      );
    });
  });

  it('calls onLogin callback with token and info', async () => {
    const axios = require('axios').default;
    axios.post.mockResolvedValueOnce({
      data: { token: 'token-abc', role: 'manager', displayName: 'Jane Smith' },
    });

    const mockOnLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} venueId="venue-001" />);

    await user.type(screen.getByPlaceholderText('Staff Email'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'pass123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith('token-abc', {
        email: 'jane@example.com',
        role: 'manager',
        displayName: 'Jane Smith',
      });
    });
  });

  it('shows error toast on login failure', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;

    axios.post.mockRejectedValueOnce(new Error('Invalid credentials'));

    const mockOnLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} venueId="venue-001" />);

    await user.type(screen.getByPlaceholderText('Staff Email'), 'wrong@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
    });
  });

  it('disables button while signing in', async () => {
    const axios = require('axios').default;
    axios.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    const mockOnLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} venueId="venue-001" />);

    await user.type(screen.getByPlaceholderText('Staff Email'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    const button = screen.getByRole('button', { name: /Signing in/i });
    expect(button).toBeDisabled();
  });
});
