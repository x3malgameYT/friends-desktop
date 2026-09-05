const { app, BrowserWindow, session, ipcMain, safeStorage, dialog, desktopCapturer } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;
function createWindow() {
  const win = new BrowserWindow({
    title: 'Friends', width: 1100, height: 760, minWidth: 800, minHeight: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadURL(page);
}
app.whenReady().then(() => {
  app.setAppUserModelId('com.friends.messenger');
  const savedFile = path.join(app.getPath('userData'), 'saved-access.bin');
  let hostProcess = null;
  function radminIp() {
    for (const addresses of Object.values(os.networkInterfaces())) for (const item of addresses || []) if (item.family === 'IPv4' && !item.internal && /^26\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(item.address)) return item.address;
    return null;
  }
  function trusted(event) {
    if (event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== page) throw new Error('Access denied');
  }
  require('./updates')({app, BrowserWindow, ipcMain, trusted});
  require('./notifications')(trusted);
  ipcMain.handle('file:save', async (event,data) => {
    trusted(event);
    if(!(data?.bytes instanceof Uint8Array) || data.bytes.byteLength>10*1024*1024 || typeof data.name!=='string') throw Error('Неверный файл');
    let name=data.name.replace(/[\\/<>:"|?*\x00-\x1f\x7f]/g,'_').slice(0,180).replace(/[. ]+$/,'') || 'file.bin';
    if(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))name='_'+name;
    const choice=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'Сохранить файл из Friends',defaultPath:path.join(app.getPath('downloads'),name)});
    if(choice.canceled || !choice.filePath)return {saved:false};
    await fs.promises.writeFile(choice.filePath,data.bytes);
    return {saved:true};
  });
  ipcMain.handle('access:load', event => {
    trusted(event);
    if (!fs.existsSync(savedFile)) return null;
    try {
      if (!safeStorage.isEncryptionAvailable()) throw new Error();
      return JSON.parse(safeStorage.decryptString(fs.readFileSync(savedFile)));
    } catch { throw new Error('Не удалось прочитать сохранённый код. Введи его снова.'); }
  });
  ipcMain.handle('access:save', (event, data) => {
    trusted(event);
    if (typeof data?.server !== 'string' || typeof data?.key !== 'string' || data.key.length > 4096) throw new Error('Invalid settings');
    const url = new URL(data.server);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (['localhost','127.0.0.1'].includes(url.hostname) || /^26\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)))) throw new Error('Invalid server');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Защищённое хранение недоступно.');
    const encrypted = safeStorage.encryptString(JSON.stringify({server:url.origin,key:data.key}));
    fs.writeFileSync(savedFile + '.tmp', encrypted);
    fs.renameSync(savedFile + '.tmp', savedFile);
  });
  ipcMain.handle('access:clear', event => {
    trusted(event);
    fs.rmSync(savedFile, {force:true});
  });
  ipcMain.handle('host:start', (event, data) => {
    trusted(event);
    if (typeof data?.key !== 'string' || data.key.length < 16) return {ok:false,error:'Неверный ключ хоста'};
    const ip = radminIp();
    if (!ip) return {ok:false,error:'Не найден Radmin VPN. Подключись к своей сети Radmin.'};
    if (hostProcess && !hostProcess.killed) return {ok:true,ip,port:3000};
    hostProcess = spawn(process.execPath, [path.join(__dirname, 'host-server.js')], { windowsHide:true, stdio:'ignore', env:{...process.env, ELECTRON_RUN_AS_NODE:'1', FRIENDS_HOST_KEY:data.key, FRIENDS_HOST_PORT:'3000'} });
    hostProcess.on('exit', () => { hostProcess=null; });
    return new Promise(resolve => setTimeout(() => resolve(hostProcess ? {ok:true,ip,port:3000} : {ok:false,error:'Порт 3000 занят другим приложением'}), 500));
  });
  ipcMain.handle('window:fullscreen', event => {
    trusted(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(!win.isFullScreen());
    return Boolean(win?.isFullScreen());
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const allowedMedia = details.mediaTypes?.every(type => type === 'audio' || type === 'video');
    callback(Boolean(contents && contents.getURL() === page && permission === 'media' && allowedMedia));
  });
  let selectedScreenSource = null;
  ipcMain.handle('screen:sources', async event => {
    trusted(event);
    const sources = await desktopCapturer.getSources({types:['screen','window'], thumbnailSize:{width:1,height:1}});
    return sources.map(source => ({id:source.id,name:source.name,type:source.id.startsWith('screen:')?'screen':'window'}));
  });
  ipcMain.handle('screen:selected', (event, id) => { trusted(event); selectedScreenSource = typeof id === 'string' ? id : null; });
  // Electron requires an explicit source for getDisplayMedia.
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({types:['screen','window'], thumbnailSize:{width:1,height:1}});
      const screen = sources.find(source => source.id === selectedScreenSource) || sources.find(source => source.id.startsWith('screen:')) || sources[0];
      callback(screen ? {video: screen, audio: 'loopback'} : {});
    } catch { callback({}); }
  });
  app.on('before-quit', () => { if(hostProcess && !hostProcess.killed) hostProcess.kill(); });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
