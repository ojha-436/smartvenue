import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
}));

vi.mock('../pages/LoginPage', () => ({
  default: ({ onLogin }) => (
    <div data-testid="login-page">
      <button onClick={() => onLogin('token-123', { role: 'security', displayName: 'John' })}>
        Mock Login
      </button>
    </div>
  ),
}));

vi.mock('../pages/DashboardPage', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard</div>,
}));

vi.mock('../pages/ZonePage', () => ({
  default: () => <div data-testid="zone-page">Zones</div>,
}));

vi.mock('../pages/TasksPage', () => ({
  default: () => <div data-testid="tasks-page">Tasks</div>,
}));

vi.mock('../pages/IncidentPage', () => ({
  default: () => <div data-testid="incident-page">Incidents</div>,
}));

describe('Staff App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows login page when not authenticated', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('shows dashboard after login', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter initialEntries={['/']}>
        <App />
      </BrowserRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();

    await user.click(screen.getByText('Mock Login'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('stores token and staff info in localStorage', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await user.click(screen.getByText('Mock Login'));

    await waitFor(() => {
      expect(localStorage.getItem('staff_token')).toBe('token-123');
      expect(localStorage.getItem('staff_info')).toBeTruthy();
    });
  });

  it('renders navigation tabs when authenticated', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await user.click(screen.getByText('Mock Login'));

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('displays staff header info when logged in', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await user.click(screen.getByText('Mock Login'));

    await waitFor(() => {
      expect(screen.getByText(/John/)).toBeInTheDocument();
      expect(screen.getByText(/security/)).toBeInTheDocument();
    });
  });

  it('restores auth state from localStorage', () => {
    localStorage.setItem('staff_token', 'token-123');
    localStorage.setItem('staff_info', JSON.stringify({ displayName: 'Jane', role: 'manager' }));

    render(
      <BrowserRouter initialEntries={['/dashboard']}>
        <App />
      </BrowserRouter>
    );

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });
});
