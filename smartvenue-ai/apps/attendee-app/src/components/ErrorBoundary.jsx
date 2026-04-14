import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-center p-6 bg-white rounded-xl shadow-lg border border-red-100">
            <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-gray-600">Please refresh the page to try again.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
