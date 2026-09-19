const { app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function scriptPath() {
  const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'scanner', 'scan.ps1');
  return app.isPackaged && fs.existsSync(unpacked) ? unpacked : path.join(__dirname, 'scan.ps1');
}

function collectSystemData() {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath()], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      try { resolve(JSON.parse(stdout.trim())); } catch { reject(new Error('Scanner returned invalid data.')); }
    });
  });
}
module.exports = { collectSystemData, scriptPath };
