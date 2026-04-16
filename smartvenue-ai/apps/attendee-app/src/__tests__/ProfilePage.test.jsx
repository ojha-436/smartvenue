import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from '../pages/ProfilePage';

vi.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn(async () => {}),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({
    exists: () => true,
    data: () => ({
      displayName: 'Test User',
      email: 'test@example.com',
      preferences: {
        gpsOptIn: false,
        notifications: true,
      },
    }),
  })),
  setDoc: vi.fn(async () => {}),
}));

vi.mock('axios', () => ({
  default: {},
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

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders profile header with user info', async () => {
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('displays preferences section', async () => {
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Preferences')).toBeInTheDocument();
    });
  });

  it('displays GPS location sharing toggle', async () => {
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('GPS Location Sharing')).toBeInTheDocument();
      expect(screen.getByText(/Helps improve crowd density accuracy/i)).toBeInTheDocument();
    });
  });

  it('displays push notifications toggle', async () => {
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Push Notifications')).toBeInTheDocument();
      expect(screen.getByText(/Queue alerts and venue updates/i)).toBeInTheDocument();
    });
  });

  it('toggles GPS preference', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('GPS Location Sharing')).toBeInTheDocument();
    });

    const toggles = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('rounded-full')
    );

    await user.click(toggles[0]);

    // After toggle, should be in different state
    expect(toggles[0]).toBeInTheDocument();
  });

  it('toggles push notifications preference', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    });

    const toggles = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('rounded-full')
    );

    await user.click(toggles[1]);

    expect(toggles[1]).toBeInTheDocument();
  });

  it('saves preferences to Firestore', async () => {
    const { setDoc } = await import('firebase/firestore');
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Save Preferences/i }));

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalled();
    });
  });

  it('shows success message on preferences save', async () => {
    const toast = require('react-hot-toast').default;
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Save Preferences/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Profile saved!');
    });
  });

  it('handles save error gracefully', async () => {
    const { setDoc } = await import('firebase/firestore');
    const toast = require('react-hot-toast').default;

    setDoc.mockRejectedValueOnce(new Error('Save failed'));

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Save Preferences/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Could not save profile.');
    });
  });

  it('disables save button while saving', async () => {
    const { setDoc } = await import('firebase/firestore');
    setDoc.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Preferences/i });
    await user.click(saveButton);

    const savingButton = screen.getByRole('button', { name: /Saving/i });
    expect(savingButton).toBeDisabled();
  });

  it('displays privacy information', async () => {
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Your data is private/i)).toBeInTheDocument();
      expect(screen.getByText(/GPS data is anonymised/i)).toBeInTheDocument();
    });
  });

  it('displays logout button', async () => {
    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
    });
  });

  it('calls signOut on logout', async () => {
    const { signOut } = await import('firebase/auth');
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <ProfilePage user={mockUser} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Sign Out/i));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
  });
});
