const {Notification, BrowserWindow, ipcMain} = require('electron');
module.exports = function setupNotifications(trusted) {
  let last = 0;
  let active = null;
  ipcMain.handle('chat:notify', (event, data) => {
    trusted(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if(!win || win.isFocused() || !Notification.isSupported()) return false;
    if(Date.now()-last < 1500) return false;
    if(typeof data?.name !== 'string' || typeof data?.text !== 'string') return false;
    last = Date.now();
    active?.close();
    active = new Notification({title:'Friends — ' + data.name.slice(0,32),body:data.text.slice(0,200),silent:true});
    active.on('click', () => {if(!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}});
    active.show();
    return true;
  });
};
