const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const { createTray } = require('./tray');
const store = require('./services/agentStore');
const api = require('./services/apiClient');
const { runScan, isRunning } = require('./services/scanAgent');
const { configureAutoLaunch } = require('./services/autoLaunch');
const log = require('./services/logger');
const { getIcon } = require('./utils/icon');

const SCAN_INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_HOURS || '24', 10) * 60 * 60 * 1000;

let tokenWindow = null;
let scanTimer = null;
let verifyRetryTimer = null;
let quitting = false;

const isBackgroundLaunch = process.argv.includes('--background');

if (!app.requestSingleInstanceLock()) app.quit();

app.on('second-instance', () => {
  if (!store.isRegistered()) {
    openTokenWindow();
  }
});

function openTokenWindow() {
  if (tokenWindow && !tokenWindow.isDestroyed()) {
    tokenWindow.show();
    tokenWindow.focus();
    return;
  }

  tokenWindow = new BrowserWindow({
    width: 460,
    height: 480,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: 'GetGRC — Activate Device',
    icon: getIcon(),
    backgroundColor: '#f4f6f8',
    webPreferences: {
      preload: path.join(__dirname, 'token-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      scrollBounce: false,
    },
  });

  tokenWindow.setMenu(null);
  tokenWindow.setMenuBarVisibility(false);
  tokenWindow.loadFile(path.join(__dirname, 'token.html'));
  tokenWindow.on('closed', () => { tokenWindow = null; });
}

async function triggerScan(silent = true) {
  if (isRunning()) return;
  try {
    if (!silent) {
      new Notification({ title: 'GetGRC', body: 'Security scan started.' }).show();
    }
    await runScan();
    if (!silent) {
      new Notification({ title: 'GetGRC', body: 'Security scan complete.' }).show();
    }
  } catch (error) {
    log.error('Scan failed', { message: error.message });
    if (!silent) {
      new Notification({ title: 'GetGRC', body: `Scan failed: ${error.message}` }).show();
    }
  }
}

function startPeriodicScans() {
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = setInterval(() => triggerScan(true), SCAN_INTERVAL_MS);
  log.info('Automatic scan scheduled every 24 hours', {
    intervalHours: SCAN_INTERVAL_MS / (60 * 60 * 1000),
  });
}

async function startRegisteredAgent({ awaitInitialScan = false } = {}) {
  configureAutoLaunch(true);
  startPeriodicScans();

  if (awaitInitialScan) {
    await triggerScan(true);
    return;
  }

  triggerScan(true).catch((error) => {
    log.error('Initial scan failed', { message: error.message });
  });
}

function applyVerifyResult(registrationKey, result) {
  const checklist = result.checklist || result.data?.checklist || null;
  const updates = {
    registrationKey,
    ...(checklist ? {
      checklistId: checklist.id,
      organizationId: checklist.organizationId,
      userId: checklist.userId,
    } : {}),
  };

  if (!store.getConfig().registeredAt) {
    updates.registeredAt = new Date().toISOString();
  }

  store.setConfig(updates);
}

function isVerifySuccess(result) {
  if (result && result.success === false) return false;
  return true;
}

async function verifySavedRegistration() {
  const key = store.getConfig().registrationKey;
  if (!key) return false;

  const result = await api.verifyRegistrationKey(key);
  if (!isVerifySuccess(result)) {
    throw new Error(result.message || 'Invalid Registration Key');
  }

  applyVerifyResult(key, result);
  log.info('Registration key verified — connected to server');
  return true;
}

function scheduleVerifyRetry() {
  if (verifyRetryTimer) clearInterval(verifyRetryTimer);
  verifyRetryTimer = setInterval(async () => {
    if (!store.isRegistered()) return;
    try {
      await verifySavedRegistration();
      if (verifyRetryTimer) {
        clearInterval(verifyRetryTimer);
        verifyRetryTimer = null;
      }
    } catch (error) {
      log.warn('Background registration retry failed', { message: error.message });
    }
  }, 5 * 60 * 1000);
}

async function bootstrapRegisteredAgent() {
  try {
    await verifySavedRegistration();
  } catch (error) {
    log.warn('Startup verify failed — agent stays in background', { message: error.message });
    scheduleVerifyRetry();
  }

  startRegisteredAgent();
}

const isInstallVerify = process.argv.includes('--install-verify');

app.whenReady().then(async () => {
  store.initServerUrl();
  const serverUrl = store.getConfig().serverUrl;
  log.info('GetGRC agent starting', {
    packaged: app.isPackaged,
    version: app.getVersion(),
    agentVersion: api.AGENT_VERSION,
    serverUrl,
    background: isBackgroundLaunch,
    registered: store.isRegistered(),
    installVerify: isInstallVerify,
  });

  if (isInstallVerify) {
    log.info('Install verification', {
      exePath: app.getPath('exe'),
      appVersion: app.getVersion(),
      registered: store.isRegistered(),
      configPath: app.getPath('userData'),
    });
    if (store.isRegistered()) {
      try {
        await verifySavedRegistration();
        log.info('Install verification — device registration OK');
      } catch (error) {
        log.warn('Install verification — registration sync pending', { message: error.message });
      }
    }
    setTimeout(() => app.quit(), 1200);
    return;
  }

  createTray({
    openTokenWindow,
    runScan: () => triggerScan(false),
    quit: () => { quitting = true; app.quit(); },
  });

  if (!store.isRegistered()) {
    openTokenWindow();
    return;
  }

  await bootstrapRegisteredAgent();
});

app.on('window-all-closed', (event) => {
  if (!quitting) event.preventDefault();
});

app.on('before-quit', () => {
  quitting = true;
  if (scanTimer) clearInterval(scanTimer);
  if (verifyRetryTimer) clearInterval(verifyRetryTimer);
});

app.on('activate', () => {
  if (!store.isRegistered()) {
    openTokenWindow();
  }
});

ipcMain.handle('token:get-config', () => store.getPublicConfig());

ipcMain.handle('token:activate', async (_event, registrationKey) => {
  const result = await api.verifyRegistrationKey(registrationKey);
  if (!isVerifySuccess(result)) {
    throw new Error(result.message || 'Invalid Registration Key');
  }

  applyVerifyResult(registrationKey, result);
  log.info('Device activated — connected to server');

  startRegisteredAgent();
  return { message: 'Device activated. GetGRC is running in the background.' };
});

ipcMain.handle('agent:status', () => {
  const { registrationKey, checklistId, organizationId, userId, lastScanAt, registeredAt } = store.getConfig();
  return {
    registrationKey: registrationKey || '',
    checklistId,
    organizationId,
    userId,
    lastScanAt,
    registeredAt,
    agentVersion: api.AGENT_VERSION,
    scanning: isRunning(),
  };
});

ipcMain.handle('agent:scan', () => triggerScan(false));
