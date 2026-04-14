import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';

// 1. Mock Firestore Database
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn((ref, callback) => {
    callback({ docs: [] }); // Simulate empty database
    return vi.fn();
  }),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

describe('HomePage Component', () => {
  const mockUser = { displayName: 'John Fan' };

  it('renders the user greeting properly', () => {
    // 2. Wrap in BrowserRouter to prevent <Link> errors
    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );
    expect(screen.getByText(/John Fan/i)).toBeInTheDocument();
  });

  it('renders all quick action navigation buttons', () => {
    render(
      <BrowserRouter>
        <HomePage user={mockUser} venueId="venue-001" />
      </BrowserRouter>
    );
    expect(screen.getByText(/Join Queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Order Food/i)).toBeInTheDocument();
    expect(screen.getByText(/Venue Map/i)).toBeInTheDocument();
  });
});
