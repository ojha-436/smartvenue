import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../pages/LoginPage';

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}));

vi.mock('../firebase', () => ({
  auth: {},
  googleAuth: {},
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with email and password inputs', () => {
    render(<LoginPage />);

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('renders Google sign-in button', () => {
    render(<LoginPage />);

    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
  });

  it('updates email input on change', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('Email');
    await user.type(emailInput, 'test@example.com');

    expect(emailInput.value).toBe('test@example.com');
  });

  it('updates password input on change', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByPlaceholderText('Password');
    await user.type(passwordInput, 'password123');

    expect(passwordInput.value).toBe('password123');
  });

  it('submits login form with email and password', async () => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object),
        'test@example.com',
        'password123'
      );
    });
  });

  it('shows error toast on login failure', async () => {
    const toast = await import('react-hot-toast');
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    signInWithEmailAndPassword.mockRejectedValueOnce(new Error('Invalid credentials'));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalled();
    });
  });

  it('disables submit button while loading', async () => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    signInWithEmailAndPassword.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    const button = screen.getByRole('button', { name: /Please wait/i });
    expect(button).toBeDisabled();
  });

  it('handles Google sign-in click', async () => {
    const { signInWithPopup } = await import('firebase/auth');
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByText(/Continue with Google/i));

    expect(signInWithPopup).toHaveBeenCalled();
  });

  it('toggles between login and signup modes', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();

    await user.click(screen.getByText(/Don't have an account/i));

    expect(screen.getByText(/Create account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
  });

  it('calls createUserWithEmailAndPassword in signup mode', async () => {
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const user = userEvent.setup();
    render(<LoginPage />);

    // Switch to signup mode
    await user.click(screen.getByText(/Don't have an account/i));

    // Fill form
    await user.type(screen.getByPlaceholderText('Email'), 'newuser@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'newpassword123');

    // Submit
    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object),
        'newuser@example.com',
        'newpassword123'
      );
    });
  });

  it('shows busy state during Google sign-in', async () => {
    const { signInWithPopup } = await import('firebase/auth');
    signInWithPopup.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 500))
    );

    const user = userEvent.setup();
    render(<LoginPage />);

    const googleButton = screen.getByText(/Continue with Google/i).closest('button');
    await user.click(googleButton);

    expect(googleButton).toBeDisabled();
  });

  it('displays SmartVenue branding', () => {
    render(<LoginPage />);

    expect(screen.getByText('SmartVenue')).toBeInTheDocument();
    expect(screen.getByText(/Your intelligent stadium companion/i)).toBeInTheDocument();
  });
});
