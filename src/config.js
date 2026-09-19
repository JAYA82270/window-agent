const DEFAULT_API_URL = process.env.API_BASE || 'https://getgrc.in';

function getApiUrl() {
  return DEFAULT_API_URL.replace(/\/+$/, '');
}

module.exports = { getApiUrl, DEFAULT_API_URL };
