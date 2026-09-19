const { Menu, Tray } = require('electron');
const { getIcon } = require('./utils/icon');

function createTray({ openTokenWindow, runScan, quit }) {
  const tray = new Tray(getIcon('tray-icon.png'));
  tray.setToolTip('GetGRC Device Security');
  const refresh = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'GetGRC Device Security', enabled: false },
    { type: 'separator' }, { label: 'Activate device', click: openTokenWindow },
    { label: 'Run security scan', click: runScan }, { type: 'separator' },
    { label: 'Quit GetGRC', click: quit },
  ]));
  tray.on('click', openTokenWindow); refresh();
  return { tray, refresh };
}
module.exports = { createTray };
