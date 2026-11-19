'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  get: () => ipcRenderer.invoke('win:get'),
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  show: () => ipcRenderer.send('win:show'),
  setSize: (w, h) => ipcRenderer.send('win:size', Number(w), Number(h)),
  setOnTop: v => ipcRenderer.send('win:onTop', !!v),
  setOpacity: v => ipcRenderer.send('win:opacity', Number(v)),
  setAutoLaunch: v => ipcRenderer.send('win:autoLaunch', !!v),
  setSkipTaskbar: v => ipcRenderer.send('win:skipTaskbar', !!v),
  setCloseToTray: v => ipcRenderer.send('win:closeToTray', !!v),
  habitLog: (file, line) => ipcRenderer.send('habit:log', String(file), String(line)),
  habitSnapshot: json => ipcRenderer.send('habit:snapshot', String(json)),
  openHabitFile: file => ipcRenderer.send('habit:open', String(file)),
  openHabitFolder: () => ipcRenderer.send('habit:folder'),
  on: (channel, fn) => {
    if (!['state', 'cmd'].includes(channel) || typeof fn !== 'function') return;
    ipcRenderer.on(channel, (e, ...args) => fn(...args));
  }
});
