const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('friendsFiles',{save:data=>ipcRenderer.invoke('file:save',data)});
contextBridge.exposeInMainWorld('friendsNotify', {
  message: data => ipcRenderer.invoke('chat:notify', data)
});
contextBridge.exposeInMainWorld('friendsWindow', {
  fullscreen: () => ipcRenderer.invoke('window:fullscreen')
});
contextBridge.exposeInMainWorld('friendsScreen', {
  sources: () => ipcRenderer.invoke('screen:sources'),
  select: id => ipcRenderer.invoke('screen:selected', id)
});
contextBridge.exposeInMainWorld('friendsUpdates', {
  state: () => ipcRenderer.invoke('updates:state'),
  check: () => ipcRenderer.invoke('updates:check'),
  download: () => ipcRenderer.invoke('updates:download'),
  install: () => ipcRenderer.invoke('updates:install'),
  subscribe: callback => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('updates:state', handler);
    return () => ipcRenderer.removeListener('updates:state', handler);
  }
});
contextBridge.exposeInMainWorld('savedAccess', {
  load: () => ipcRenderer.invoke('access:load'),
  save: data => ipcRenderer.invoke('access:save', data),
  clear: () => ipcRenderer.invoke('access:clear')
});
contextBridge.exposeInMainWorld('friendsHost', {
  start: data => ipcRenderer.invoke('host:start', data)
});
