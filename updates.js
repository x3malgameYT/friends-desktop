const { autoUpdater } = require('electron-updater');

module.exports = function setupUpdates({app, BrowserWindow, ipcMain, trusted}) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  let state = {status:'idle', version:app.getVersion()};
  let busy = false;
  function report(status, extra = {}) {
    state = {status, version:app.getVersion(), ...extra};
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('updates:state', state);
    }
  }
  autoUpdater.on('checking-for-update', () => report('checking'));
  autoUpdater.on('update-available', info => report('available', {nextVersion:info.version}));
  autoUpdater.on('update-not-available', () => report('current'));
  autoUpdater.on('download-progress', info => report('downloading', {percent:Math.round(info.percent)}));
  autoUpdater.on('update-downloaded', info => report('ready', {nextVersion:info.version}));
  autoUpdater.on('error', () => {busy=false;report('error');});if(app.isPackaged)setTimeout(()=>autoUpdater.checkForUpdates().catch(()=>{}),4000);
  ipcMain.handle('updates:state', event => {trusted(event);return state;});
  ipcMain.handle('updates:check', async event => {
    trusted(event);
    if (busy || ['available','ready'].includes(state.status)) return state;
    if (!app.isPackaged) {report('development');return state;}
    busy=true;
    try { await autoUpdater.checkForUpdates(); }
    catch {report('error');}
    finally {busy=false;}
    return state;
  });
  ipcMain.handle('updates:download', async event => {
    trusted(event);
    if (busy || state.status !== 'available') return state;
    busy=true;report('downloading',{percent:0});
    try {await autoUpdater.downloadUpdate();}
    catch {report('error');}
    finally {busy=false;}
    return state;
  });
  ipcMain.handle('updates:install', event => {
    trusted(event);
    if(state.status !== 'ready') return false;
    setImmediate(() => autoUpdater.quitAndInstall(false,true));
    return true;
  });
};
