import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for this test suite
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Test Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('displays error message when child throws error', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Please refresh the page to try again.')).toBeInTheDocument();
  });

  it('displays error UI with proper styling', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const errorContainer = container.querySelector('.bg-gray-50');
    expect(errorContainer).toBeInTheDocument();

    const errorBox = container.querySelector('.bg-white');
    expect(errorBox).toBeInTheDocument();
    expect(errorBox).toHaveClass('rounded-xl', 'shadow-lg', 'border');
  });

  it('renders fallback UI when multiple children error', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <div>First Child</div>
        <ThrowError />
        <div>Third Child</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('First Child')).not.toBeInTheDocument();
    expect(screen.queryByText('Third Child')).not.toBeInTheDocument();
  });

  it('has getDerivedStateFromError defined', () => {
    expect(ErrorBoundary.getDerivedStateFromError).toBeDefined();
    expect(typeof ErrorBoundary.getDerivedStateFromError).toBe('function');
  });

  it('sets hasError state to true on error', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Verify error state is active by checking for error text
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays red error styling', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const heading = screen.getByText('Something went wrong');
    expect(heading).toHaveClass('text-red-600');
  });
});
