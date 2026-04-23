// API Configuration
// Use this file to configure the backend URL based on environment

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''  // Local development - uses relative URLs
  : 'https://task-manager-api.onrender.com'; // Production - replace with your Render URL

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const url = API_BASE + endpoint;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response;
}