/**
 * config.js — Central runtime configuration for BankShield client.
 *
 * __API_BASE_URL__ is injected by vite.config.js define at build time:
 *   - dev build  (npm run dev):   '' → falls back to '/api' → Vite proxy → localhost:5000
 *   - prod build (npm run build): 'https://bankshield-api-5m3j.onrender.com/api'
 *
 * To change the backend URL update vite.config.js define only.
 */

/* global __API_BASE_URL__ */
const injected = typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '';

export const API_BASE_URL = injected || '/api';
