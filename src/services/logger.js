const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function write(level, message, details) {
  const line = `${new Date().toISOString()} [${level}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}\n`;
  console[level === 'ERROR' ? 'error' : 'log'](line.trim());
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'agent.log'), line); } catch { /* logging must not stop scans */ }
}
module.exports = { info: (m, d) => write('INFO', m, d), warn: (m, d) => write('WARN', m, d), error: (m, d) => write('ERROR', m, d) };
