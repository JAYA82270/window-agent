const { app } = require('electron');

function configureAutoLaunch(enabled = true) {
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--background'] });
}
module.exports = { configureAutoLaunch };
