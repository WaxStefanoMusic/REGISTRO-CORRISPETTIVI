// Ponte tra l'app (pagina) e il controllo aggiornamenti in main.js
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, cb) => ipcRenderer.on(channel, (_e, data) => cb(data));

contextBridge.exposeInMainWorld('updater', {
  onAvailable: cb => on('upd:available', cb),
  onProgress: cb => on('upd:progress', cb),
  onDownloaded: cb => on('upd:downloaded', cb),
  onError: cb => on('upd:error', cb),
  onNone: cb => on('upd:none', cb),
  download: () => ipcRenderer.send('upd:download'),
});
