/**
 * Custom hook for fetching data from API endpoints with auth, loading, and error states
 * Handles token injection, error notifications, and request cancellation
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { attendeeApi, queueApi, orderApi, venueApi } from '../api';

/**
 * Hook for making authenticated API requests
 * Automatically injects Firebase ID token and handles errors with toast notifications
 * Includes abort controller for cleanup on unmount
 *
 * @param {string} [url] Initial URL to fetch from (optional, can be omitted to use manual execute())
 * @param {Object} [options] Request options
 * @param {string} [options.method='GET'] HTTP method
 * @param {Object} [options.headers] Additional headers
 * @param {Object} [options.data] Request body data (for POST/PUT)
 * @param {string} [options.client='attendee'] Which API client to use: 'attendee', 'queue', 'order', or 'venue'
 * @param {boolean} [options.autoFetch=true] Whether to automatically fetch on mount (only if url provided)
 * @returns {{
 *   data: any,
 *   loading: boolean,
 *   error: Error|null,
 *   execute: Function
 * }}
 *   - data: Response data from the API
 *   - loading: True while request is in progress
 *   - error: Error object if request failed, null otherwise
 *   - execute: Manual function to trigger the request (url, data) => Promise
 *
 * @example
 * const { data: menu, loading, error } = useApi(
 *   `/api/menu/${venueId}`,
 *   { client: 'order' }
 * );
 *
 * @example
 * const { execute: placeOrder, loading } = useApi(null, {
 *   method: 'POST',
 *   client: 'order',
 * });
 * const handleSubmit = async (items) => {
 *   await placeOrder('/api/orders', { items });
 * };
 */
export function useApi(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    data = null,
    client = 'attendee',
    autoFetch = true,
  } = options;

  const [responseData, setResponseData] = useState(null);
  const [loading, setLoading] = useState(!!url && autoFetch);
  const [error, setError] = useState(null);

  // Ref to store abort controller for cleanup
  const abortControllerRef = useRef(null);

  /**
   * Get the appropriate API client
   */
  const getClient = useCallback(() => {
    switch (client) {
      case 'queue':
        return queueApi;
      case 'order':
        return orderApi;
      case 'venue':
        return venueApi;
      case 'attendee':
      default:
        return attendeeApi;
    }
  }, [client]);

  /**
   * Execute the API request
   * @param {string} [requestUrl] URL to request (uses initial url if not provided)
   * @param {any} [requestData] Request body data
   * @returns {Promise<any>} Response data
   */
  const execute = useCallback(
    async (requestUrl = url, requestData = data) => {
      if (!requestUrl) {
        console.error('useApi: No URL provided to execute()');
        return null;
      }

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const apiClient = getClient();
        const config = {
          method,
          headers,
          signal: abortControllerRef.current.signal,
        };

        let response;
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
          response = await apiClient[method.toLowerCase()](requestUrl, requestData || data, config);
        } else {
          response = await apiClient.get(requestUrl, config);
        }

        setResponseData(response.data);
        setError(null);
        return response.data;
      } catch (err) {
        // Don't report errors from abort() calls
        if (err.name !== 'CanceledError') {
          console.error('API request failed:', err);
          setError(err);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [url, data, method, headers, getClient]
  );

  /**
   * Auto-fetch on mount if URL and autoFetch are provided
   */
  useEffect(() => {
    if (url && autoFetch) {
      execute(url);
    }

    // Cleanup: cancel pending requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [url, autoFetch, execute]);

  return { data: responseData, loading, error, execute };
}

export default useApi;
