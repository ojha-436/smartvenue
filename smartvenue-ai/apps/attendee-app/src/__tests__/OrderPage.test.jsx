import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderPage from '../pages/OrderPage';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
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

describe('OrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders order page header', () => {
    const axios = require('axios').default;
    axios.get.mockResolvedValueOnce({ data: { items: [] } });

    render(<OrderPage user={mockUser} venueId="venue-001" />);

    expect(screen.getByText('Order Food')).toBeInTheDocument();
  });

  it('loads menu from API', async () => {
    const axios = require('axios').default;
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food' },
          { id: 'item-2', name: 'Coke', price: 30, category: 'Drinks' },
        ],
      },
    });

    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
      expect(screen.getByText('Coke')).toBeInTheDocument();
    });
  });

  it('groups menu items by category', async () => {
    const axios = require('axios').default;
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food' },
          { id: 'item-2', name: 'Hotdog', price: 40, category: 'Food' },
          { id: 'item-3', name: 'Coke', price: 30, category: 'Drinks' },
        ],
      },
    });

    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      const categoryHeaders = screen.getAllByText(/FOOD|DRINKS/i);
      expect(categoryHeaders.length).toBeGreaterThan(0);
    });
  });

  it('adds item to cart', async () => {
    const axios = require('axios').default;
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Add/i }));

    expect(screen.getByText('1 item(s) · ₹50.00')).toBeInTheDocument();
  });

  it('removes item from cart', async () => {
    const axios = require('axios').default;
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    // Add item
    await user.click(screen.getByRole('button', { name: /Add/i }));
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // Remove item
    const minusButtons = screen.getAllByRole('button');
    const minusButton = minusButtons.find(btn => btn.textContent.includes('−'));
    await user.click(minusButton);

    await waitFor(() => {
      expect(screen.queryByText(/1 item/)).not.toBeInTheDocument();
    });
  });

  it('increments item quantity', async () => {
    const axios = require('axios').default;
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button');
    const addButton = addButtons.find(btn => btn.textContent.includes('+'));

    await user.click(addButton);
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    await user.click(addButton);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    expect(screen.getByText('2 item(s) · ₹100.00')).toBeInTheDocument();
  });

  it('calculates total price correctly', async () => {
    const axios = require('axios').default;
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 100, category: 'Food' },
          { id: 'item-2', name: 'Fries', price: 50, category: 'Food' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button');

    // Add burger (100)
    await user.click(addButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('1 item(s) · ₹100.00')).toBeInTheDocument();
    });

    // Add fries (50)
    await user.click(addButtons[2]);
    await waitFor(() => {
      expect(screen.getByText('2 item(s) · ₹150.00')).toBeInTheDocument();
    });
  });

  it('places order successfully', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;

    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food', standId: 'stand-a' },
        ],
      },
    });

    axios.post.mockResolvedValueOnce({
      data: { orderId: 'order-123', estimatedReadyMins: 10 },
    });

    const user = userEvent.setup();
    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button');
    await user.click(addButtons[0]);

    const placeOrderButton = screen.getByRole('button', { name: /Place Order/i });
    await user.click(placeOrderButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders'),
        expect.objectContaining({
          userId: 'test-user-123',
          venueId: 'venue-001',
        })
      );
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('displays order confirmation after placement', async () => {
    const axios = require('axios').default;
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food', standId: 'stand-a' },
        ],
      },
    });

    axios.post.mockResolvedValueOnce({
      data: { orderId: 'order-abc123', estimatedReadyMins: 15 },
    });

    const user = userEvent.setup();
    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button');
    await user.click(addButtons[0]);

    await user.click(screen.getByRole('button', { name: /Place Order/i }));

    await waitFor(() => {
      expect(screen.getByText('Order confirmed!')).toBeInTheDocument();
      expect(screen.getByText(/Ready in ~15 minutes/i)).toBeInTheDocument();
    });
  });

  it('shows error on order placement failure', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;

    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food', standId: 'stand-a' },
        ],
      },
    });

    axios.post.mockRejectedValueOnce(new Error('Order failed'));

    const user = userEvent.setup();
    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button');
    await user.click(addButtons[0]);

    await user.click(screen.getByRole('button', { name: /Place Order/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('prevents order placement with empty cart', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;

    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    // Cart is empty, so place order button shouldn't exist
    expect(screen.queryByRole('button', { name: /Place Order/i })).not.toBeInTheDocument();
  });

  it('displays loading state while fetching menu', () => {
    const axios = require('axios').default;
    axios.get.mockImplementation(() => new Promise(() => {}));

    render(<OrderPage user={mockUser} venueId="venue-001" />);

    expect(screen.getByText(/Loading menu/i)).toBeInTheDocument();
  });

  it('handles menu loading error', async () => {
    const axios = require('axios').default;
    const toast = require('react-hot-toast').default;

    axios.get.mockRejectedValueOnce(new Error('Network error'));

    render(<OrderPage user={mockUser} venueId="venue-001" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Could not load menu');
    });
  });
});
