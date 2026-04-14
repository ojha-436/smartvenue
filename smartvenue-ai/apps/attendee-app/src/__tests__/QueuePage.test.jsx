import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QueuePage from '../pages/QueuePage';

describe('QueuePage Component', () => {
  it('renders the queue interface without crashing', () => {
    const { container } = render(<QueuePage user={{}} venueId="venue-001" />);
    expect(container).toBeTruthy();
  });
});
