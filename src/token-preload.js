const { contextBridge, ipcRenderer } = require('electron');

function cleanError(error) {
  const raw = error?.message || String(error || '');
  const match = raw.match(/Error invoking remote method '[^']+':\s*(?:Error:\s*)?(.+)/i);
  const message = (match ? match[1] : raw).trim();

  if (/invalid registration key/i.test(message)) {
    return 'Invalid registration key. Please check and try again.';
  }
  if (/unable to connect|cannot reach|network/i.test(message)) {
    return 'Unable to connect. Please try again in a moment.';
  }
  if (/request failed/i.test(message)) {
    return 'Activation failed. Please try again.';
  }

  return message || 'Activation failed. Please try again.';
}

contextBridge.exposeInMainWorld('shyldoneToken', {
  getConfig: () => ipcRenderer.invoke('token:get-config'),
  activate: async (registrationKey) => {
    try {
      return await ipcRenderer.invoke('token:activate', registrationKey);
    } catch (error) {
      throw new Error(cleanError(error));
    }
  },
});
