/**
 * Error Boundary component for catching React errors
 * Displays recovery instructions and logs errors for debugging
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * Error Boundary component
 * Catches React errors in child components and displays a fallback UI
 * with recovery options
 */
export default class ErrorBoundary extends React.Component {
  /**
   * @param {Object} props
   * @param {React.ReactNode} props.children - Child components to protect
   */
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  /**
   * Log error and error info
   */
  componentDidCatch(error, errorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));
  }

  /**
   * Handle recovery - reset error state
   */
  handleRecover = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Handle page refresh
   */
  handleRefresh = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === 'development';

      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center px-4 bg-red-50"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-6 space-y-4">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
            </div>

            {/* Error Title */}
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-gray-800">Something went wrong</h1>
              <p className="text-sm text-gray-500">
                We encountered an unexpected error. Please try one of the options below.
              </p>
            </div>

            {/* Error Details (Development Only) */}
            {isDev && this.state.error && (
              <div className="bg-gray-100 rounded-lg p-3 space-y-2">
                <p className="text-xs font-mono text-gray-700 break-words">
                  <strong>Error:</strong> {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer font-semibold">Stack Trace</summary>
                    <pre className="mt-2 whitespace-pre-wrap font-mono">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Recovery Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Try these steps:</strong>
                <ol className="mt-2 space-y-1 ml-4 list-decimal">
                  <li>Refresh the page and try again</li>
                  <li>Clear your browser cache</li>
                  <li>Close the app and reopen it</li>
                </ol>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={this.handleRecover}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleRefresh}
                className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Go to Home
              </button>
            </div>

            {/* Error Count Warning */}
            {this.state.errorCount > 2 && (
              <p className="text-xs text-orange-600 text-center">
                Multiple errors detected. If issues persist, please contact support.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};
