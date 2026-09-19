const { collectSystemData } = require('../scanner/systemScanner');
const api = require('./apiClient');
const store = require('./agentStore');
const log = require('./logger');

let running = false;

async function runScan() {
  if (running) return { success: false, message: 'A scan is already running.' };

  const { registrationKey, checklistId } = store.getConfig();

  if (!registrationKey) {
    throw new Error('Activate GetGRC before running a scan.');
  }

  running = true;
  try {
    const scanData = await collectSystemData();

    const payload = {
      registrationKey,
      deviceUuid: scanData.deviceUuid,
      computerName: scanData.computerName,
      username: scanData.username,
      ipAddress: scanData.ipAddress,
      macAddress: scanData.macAddress,
      scanStatus: 'SUCCESS',
      agentVersion: api.AGENT_VERSION,
      scanData,
    };

    if (checklistId) {
      payload.checklistId = checklistId;
      payload.tokenId = checklistId;
    }

    const result = await api.uploadScan(payload);
    store.setConfig({ lastScanAt: new Date().toISOString() });
    log.info('Scan uploaded', result);
    return result;
  } finally {
    running = false;
  }
}

module.exports = { runScan, isRunning: () => running };
