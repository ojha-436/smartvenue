import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

vi.mock('../firebase', () => ({
  auth: { onAuthStateChanged: vi.fn((cb) => cb({ uid: '123', displayName: 'Test User' })) },
  db: {}
}));

describe('Full App Integration', () => {
  it('navigates through protected routes successfully', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    });
  });
});
