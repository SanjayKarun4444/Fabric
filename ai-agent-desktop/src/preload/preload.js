const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Agent commands
  sendCommand: (command, args) => ipcRenderer.invoke('send-command', command, args),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Agent status
  getAgentStatus: () => ipcRenderer.invoke('get-agent-status'),
  
  // File operations
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  
  // External
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // Logs and export
  getLogs: (lines) => ipcRenderer.invoke('get-logs', lines),
  exportData: (dataType) => ipcRenderer.invoke('export-data', dataType),
  
  // Window controls
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  
  // Event listeners
  onAgentLog: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('agent-log', subscription);
    return () => ipcRenderer.removeListener('agent-log', subscription);
  },
  
  onAgentUpdate: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('agent-update', subscription);
    return () => ipcRenderer.removeListener('agent-update', subscription);
  },
  
  onNavigate: (callback) => {
    const subscription = (_, page) => callback(page);
    ipcRenderer.on('navigate-to', subscription);
    return () => ipcRenderer.removeListener('navigate-to', subscription);
  },
  
  // System info
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});

// Log that preload completed
console.log('✓ Preload script loaded');
