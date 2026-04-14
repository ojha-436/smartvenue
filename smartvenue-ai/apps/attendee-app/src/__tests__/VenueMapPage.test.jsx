import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VenueMapPage from '../pages/VenueMapPage';

describe('VenueMapPage Component', () => {
  it('renders the map container without crashing', () => {
    const { container } = render(<VenueMapPage user={{}} venueId="venue-001" />);
    expect(container).toBeTruthy();
  });
});
