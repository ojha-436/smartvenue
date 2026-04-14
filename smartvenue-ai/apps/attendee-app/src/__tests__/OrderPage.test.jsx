import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OrderPage from '../pages/OrderPage';

describe('OrderPage Component', () => {
  it('renders the order interface without crashing', () => {
    const { container } = render(<OrderPage user={{}} venueId="venue-001" />);
    expect(container).toBeTruthy();
  });
});
