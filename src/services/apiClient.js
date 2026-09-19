const { getConfig } = require('./agentStore');
const log = require('./logger');

const AGENT_VERSION = 'GetGRC Device Monitor 1.0.0';
const SERVER_ERROR = 'Unable to connect to the server. Please try again in a moment.';

const ENDPOINTS = {
  verify: '/api/scan/verify',
  upload: '/api/scan/upload',
};

function buildUrl(path) {
  return `${getConfig().serverUrl.replace(/\/$/, '')}${path}`;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function request(path, body) {
  const url = buildUrl(path);
  log.info('API request', { path, url });

  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 15000);
  } catch (error) {
    log.error('Server unreachable', { path, url, message: error.message });
    throw new Error(SERVER_ERROR);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    log.error('API request failed', { path, status: response.status, message: data.message });
    throw new Error(data.message || 'Request failed. Please try again.');
  }

  log.info('Server connected', { path, status: response.status });
  return data;
}

function verifyRegistrationKey(registrationKey) {
  return request(ENDPOINTS.verify, { registrationKey });
}

function uploadScan(payload) {
  return request(ENDPOINTS.upload, {
    ...payload,
    agentVersion: payload.agentVersion || AGENT_VERSION,
  });
}

module.exports = {
  verifyRegistrationKey,
  uploadScan,
  AGENT_VERSION,
  SERVER_ERROR,
  ENDPOINTS,
};
