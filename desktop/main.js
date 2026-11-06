// Registro Corrispettivi – app desktop (Electron)
// DPI: Electron è "Per-Monitor DPI Aware v2": testo e grafica restano nitidi con qualunque
// ridimensionamento di Windows (100%, 125%, 150%, 200%...) e anche spostando la finestra
// tra monitor diversi. In più, su schermi molto grandi (2K/4K a scala 100%) l'app si ingrandisce
// da sola; lo zoom si può sempre cambiare con Ctrl + / Ctrl − / Ctrl 0 o Ctrl + rotellina.
const { app, BrowserWindow, Menu, screen, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const STATE_FILE = () => path.join(app.getPath('userData'), 'finestra.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')); } catch { return {}; }
}
function writeState(s) {
  try { fs.writeFileSync(STATE_FILE(), JSON.stringify(s, null, 2)); } catch { /* non bloccante */ }
}

// zoom automatico in base allo spazio disponibile (in pixel "logici", già al netto della scala di Windows)
function autoZoom(display) {
  const w = display.workAreaSize.width;
  if (w >= 2400) return Math.min(2, Math.round((w / 1920) * 10) / 10); // 2K/4K a scala bassa
  return 1;
}

let win;

function createWindow() {
  const state = readState();
  const display = state.bounds ? screen.getDisplayMatching(state.bounds) : screen.getPrimaryDisplay();
  const wa = display.workArea;

  win = new BrowserWindow({
    title: 'Registro Corrispettivi',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    x: state.bounds?.x ?? wa.x + Math.round(wa.width * 0.05),
    y: state.bounds?.y ?? wa.y + Math.round(wa.height * 0.05),
    width: state.bounds?.width ?? Math.round(wa.width * 0.9),
    height: state.bounds?.height ?? Math.round(wa.height * 0.9),
    minWidth: 360,
    minHeight: 480,
    backgroundColor: '#f4f5f7',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (state.maximized !== false) win.maximize();
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  win.webContents.on('did-finish-load', () => {
    // zoom scelto dall'utente se c'è, altrimenti quello automatico per lo schermo
    const zoom = typeof state.zoom === 'number' ? state.zoom : autoZoom(screen.getDisplayMatching(win.getBounds()));
    win.webContents.setZoomFactor(zoom);
    win.show();
    checkUpdates(false);
  });

  // Ctrl + rotellina = zoom (come nei browser)
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on('zoom-changed', (_e, dir) => setZoom(dir === 'in' ? 0.1 : -0.1));

  // eventuali link esterni si aprono nel browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  const saveState = () => {
    if (!win || win.isDestroyed()) return;
    const s = readState();
    s.maximized = win.isMaximized();
    if (!win.isMaximized() && !win.isMinimized()) s.bounds = win.getBounds();
    writeState(s);
  };
  // la tastiera torna sempre alla pagina quando la finestra riprende il focus
  win.on('focus', () => win.webContents.focus());

  win.on('close', saveState);
  win.on('resize', saveState);
  win.on('move', saveState);
}

function setZoom(delta) {
  if (!win) return;
  const s = readState();
  const z = delta === 0
    ? autoZoom(screen.getDisplayMatching(win.getBounds()))
    : Math.min(3, Math.max(0.5, +(win.webContents.getZoomFactor() + delta).toFixed(2)));
  win.webContents.setZoomFactor(z);
  if (delta === 0) { delete s.zoom; delete s.zoomManual; } else { s.zoom = z; s.zoomManual = true; }
  writeState(s);
}

// ---------- PDF ----------
// Il PDF lo crea Chromium dalla stampa A4 della pagina: testo vero, selezionabile e ricercabile.
ipcMain.handle('pdf:save', async (_e, name) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Salva PDF',
    defaultPath: path.join(app.getPath('documents'), `${name}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  win.webContents.focus();
  if (canceled || !filePath) return null;
  const data = await win.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(filePath, data);
  return filePath;
});

// ---------- stampa ----------
ipcMain.handle('print:list', async () => (await win.webContents.getPrintersAsync()).map(p => ({
  name: p.name, displayName: p.displayName, isDefault: p.isDefault, model: p.options?.['printer-make-and-model'] || '',
})));
ipcMain.handle('print:run', (_e, { deviceName, copies }) => new Promise(resolve => {
  win.webContents.print({ silent: true, deviceName, copies, printBackground: true }, (ok, reason) => resolve({ ok, reason }));
}));

// ---------- aggiornamenti da GitHub ----------
// All'avvio controlla se c'è una versione nuova nelle Release del progetto su GitHub e lo
// segnala con un popup nell'app ("Aggiorna" / "Chiudi"). Con "Chiudi" non si aggiorna:
// il popup ricompare alla prossima apertura, oppure da menu ? > Verifica aggiornamenti.
const UPD_LOG = () => path.join(app.getPath('userData'), 'aggiornamenti.log');
const log = (...a) => { try { fs.appendFileSync(UPD_LOG(), `${new Date().toISOString()} ${a.join(' ')}\n`); } catch { /* non bloccante */ } };
autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
let manualCheck = false, downloading = false;

const send = (channel, data) => { if (win && !win.isDestroyed()) win.webContents.send(channel, data); };

autoUpdater.on('update-available', info => send('upd:available', { version: info.version, current: app.getVersion() }));
autoUpdater.on('update-not-available', () => { if (manualCheck) send('upd:none', app.getVersion()); });
autoUpdater.on('download-progress', p => send('upd:progress', p.percent));
autoUpdater.on('update-downloaded', () => {
  send('upd:downloaded');
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200); // installa e riapre l'app
});
autoUpdater.on('error', err => {
  // senza internet all'avvio non si disturba nessuno; l'errore si mostra solo se l'utente l'ha chiesto
  if (downloading || manualCheck) send('upd:error', err?.message?.split(/\r?\n/)[0] || String(err));
  downloading = false;
});

ipcMain.on('upd:download', () => { downloading = true; autoUpdater.downloadUpdate().catch(() => {}); });

function checkUpdates(manual) {
  if (!app.isPackaged) return;
  manualCheck = manual;
  autoUpdater.checkForUpdates().catch(() => {});
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Stampa…', accelerator: 'CmdOrCtrl+P', click: () => win?.webContents.executeJavaScript("document.getElementById('btnPrint').click()") },
        { type: 'separator' },
        { label: 'Esci', role: 'quit' },
      ],
    },
    {
      label: 'Modifica',
      submenu: [
        { label: 'Annulla', role: 'undo' }, { label: 'Ripeti', role: 'redo' }, { type: 'separator' },
        { label: 'Taglia', role: 'cut' }, { label: 'Copia', role: 'copy' }, { label: 'Incolla', role: 'paste' },
        { label: 'Seleziona tutto', role: 'selectAll' },
      ],
    },
    {
      label: 'Visualizza',
      submenu: [
        { label: 'Ingrandisci', accelerator: 'CmdOrCtrl+Plus', click: () => setZoom(0.1) },
        { label: 'Ingrandisci', accelerator: 'CmdOrCtrl+=', visible: false, click: () => setZoom(0.1) },
        { label: 'Riduci', accelerator: 'CmdOrCtrl+-', click: () => setZoom(-0.1) },
        { label: 'Dimensione automatica', accelerator: 'CmdOrCtrl+0', click: () => setZoom(0) },
        { type: 'separator' },
        { label: 'Schermo intero', role: 'togglefullscreen' },
        { label: 'Ricarica', accelerator: 'F5', role: 'reload' },
      ],
    },
    {
      label: '?',
      submenu: [
        { label: 'Verifica aggiornamenti', click: () => checkUpdates(true) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// una sola finestra aperta alla volta
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    app.setAppUserModelId('it.mobilimagro.registrocorrispettivi');
    buildMenu();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
