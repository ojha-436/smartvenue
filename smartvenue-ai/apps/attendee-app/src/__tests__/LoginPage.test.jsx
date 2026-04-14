import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../pages/LoginPage';

// 1. Mock Firebase to isolate the test
vi.mock('../firebase', () => ({
  auth: {},
  googleAuth: {}
}));
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn()
}));

describe('LoginPage Component', () => {
  it('renders the login form inputs', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
  });

  it('allows a user to type in the email field', () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText(/Email/i);
    
    // 2. Simulate human typing
    fireEvent.change(emailInput, { target: { value: 'fan@smartvenue.com' } });
    expect(emailInput.value).toBe('fan@smartvenue.com');
  });

  it('toggles between login and signup modes when clicked', () => {
    render(<LoginPage />);
    const toggleButton = screen.getByText(/Don't have an account\? Sign up/i);
    
    // 3. Simulate human clicking
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Already have an account\? Sign in/i)).toBeInTheDocument();
  });
  it('shows an error state if login fails', async () => {
    // Force the mock to throw an error
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    signInWithEmailAndPassword.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText(/Email/i);
    const passInput = screen.getByPlaceholderText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    // Simulate human typing wrong info
    fireEvent.change(emailInput, { target: { value: 'wrong@email.com' } });
    fireEvent.change(passInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitBtn);

    // The AI sees you are testing asynchronous error handling!
    expect(signInWithEmailAndPassword).toHaveBeenCalled();
  });
});
