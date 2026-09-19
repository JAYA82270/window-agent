const Store = require('electron-store');
const { getApiUrl } = require('../config');

const store = new Store({
  name: 'shyldone-agent',
  defaults: {
    serverUrl: getApiUrl(),
    registrationKey: '',
    checklistId: null,
    organizationId: null,
    userId: null,
    lastScanAt: null,
    registeredAt: null,
  },
});

function getConfig() { return store.store; }

function getPublicConfig() {
  const { registrationKey } = store.store;
  return { registrationKey: registrationKey || '' };
}

function setConfig(values) {
  if (values.serverUrl) {
    values.serverUrl = String(values.serverUrl).replace(/\/+$/, '');
  }
  store.set(values);
  return getConfig();
}

function initServerUrl() {
  const url = getApiUrl();
  const current = store.get('serverUrl');
  const isLocal = !current || current.includes('localhost') || current.includes('127.0.0.1');
  if (isLocal || process.env.API_BASE) {
    store.set('serverUrl', url);
  }
}

function clearRegistration() {
  store.set({
    registrationKey: '',
    checklistId: null,
    organizationId: null,
    userId: null,
    lastScanAt: null,
  });
}

function isRegistered() {
  return !!getConfig().registrationKey;
}

module.exports = {
  getConfig,
  getPublicConfig,
  setConfig,
  initServerUrl,
  clearRegistration,
  isRegistered,
};
