import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../pages/LoginPage';
import * as firebaseAuth from 'firebase/auth';

// 1. Mock the Firebase Auth module so we don't make real network requests during testing
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
}));

// Mock the local firebase config
vi.mock('../firebase', () => ({
  auth: {},
  googleProvider: {},
}));

describe('LoginPage Integration & Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the core UI components', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined();
    expect(screen.getByLabelText(/Password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDefined();
  });

  it('toggles to Sign Up mode successfully', () => {
    render(<LoginPage />);
    const toggleButton = screen.getByText(/Don't have an account\?/i).nextSibling;
    fireEvent.click(toggleButton);
    expect(screen.getByRole('heading', { name: /Create an Account/i })).toBeDefined();
  });

  it('handles Google Sign-In interaction', async () => {
    render(<LoginPage />);
    const googleBtn = screen.getByText(/Continue with Google/i);
    fireEvent.click(googleBtn);
    
    await waitFor(() => {
      expect(firebaseAuth.signInWithPopup).toHaveBeenCalled();
    });
  });

  it('EDGE CASE: displays an error message when Firebase authentication fails', async () => {
    // Force Firebase to throw an error
    firebaseAuth.signInWithEmailAndPassword.mockRejectedValue(new Error('auth/invalid-credential'));
    
    render(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpassword' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    
    // Check if the error message appears on screen
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/Firebase Error/i)).toBeDefined();
    });
  });
});
