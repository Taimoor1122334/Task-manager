// API Configuration
// Use this file to configure the backend URL based on environment

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''  // Local development - uses relative URLs
  : ''; // Production - Vercel serves API from same domain

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