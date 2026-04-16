/**
 * Axios API client with Firebase auth token injection and error handling
 * Provides typed API endpoints for attendee, queue, order, and venue services
 */

import axios from 'axios';
import { getAuth } from 'firebase/auth';
import toast from 'react-hot-toast';
import { API_ENDPOINTS } from './constants';

/**
 * Create an axios instance with base configuration
 * @param {string} baseURL - Base URL for the API
 * @returns {import('axios').AxiosInstance}
 */
const createApiClient = (baseURL) => {
  const client = axios.create({ baseURL, timeout: 10000 });

  /**
   * Request interceptor: inject Firebase auth token
   */
  client.interceptors.request.use(
    async (config) => {
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        console.error('Failed to get auth token:', err);
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  /**
   * Response interceptor: handle errors consistently
   */
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const message = error.response?.data?.error || error.message || 'An error occurred';

      // Only show toast for non-expected errors
      if (error.response?.status >= 500 || error.code === 'ECONNABORTED') {
        toast.error(message);
      }

      return Promise.reject(error);
    }
  );

  return client;
};

/**
 * Attendee API client for check-in and profile endpoints
 */
export const attendeeApi = createApiClient(API_ENDPOINTS.attendee);

/**
 * Queue API client for virtual queue operations
 */
export const queueApi = createApiClient(API_ENDPOINTS.queue);

/**
 * Order API client for food ordering endpoints
 */
export const orderApi = createApiClient(API_ENDPOINTS.order);

/**
 * Crowd/Venue API client for zone and crowd data endpoints
 */
export const venueApi = createApiClient(API_ENDPOINTS.crowd);

export default createApiClient;
