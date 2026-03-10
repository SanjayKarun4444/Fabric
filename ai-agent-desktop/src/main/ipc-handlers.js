const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;

function initializeIpcHandlers(mainWindow, store) {
  // Send command to agent
  ipcMain.handle('send-command', async (event, command, args = {}) => {
    try {
      const agentManager = global.agentManager;
      if (!agentManager) {
        return { success: false, error: 'Agent not initialized' };
      }

      const result = await agentManager.executeCommand(command, args);
      return result;
    } catch (error) {
      console.error('Error executing command:', error);
      return { success: false, error: error.message };
    }
  });

  // Get settings
  ipcMain.handle('get-settings', async () => {
    try {
      return { success: true, settings: store.store };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Save settings
  ipcMain.handle('save-settings', async (event, settings) => {
    try {
      // Update store
      Object.keys(settings).forEach(key => {
        store.set(key, settings[key]);
      });

      // Reinitialize scheduled tasks if schedules changed
      if (settings.schedules) {
        const { initializeScheduledTasks } = require('./main');
        if (initializeScheduledTasks) {
          initializeScheduledTasks();
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get agent status
  ipcMain.handle('get-agent-status', async () => {
    try {
      const agentManager = global.agentManager;
      if (!agentManager) {
        return { success: false, error: 'Agent not initialized' };
      }

      const status = agentManager.getStatus();
      return { success: true, status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Open external link
  ipcMain.handle('open-external', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Show open dialog
  ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, options);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Show save dialog
  ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, options);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Read file
  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Write file
  ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get app version
  ipcMain.handle('get-app-version', async () => {
    try {
      const { app } = require('electron');
      return { success: true, version: app.getVersion() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Check for updates (placeholder for auto-updater)
  ipcMain.handle('check-for-updates', async () => {
    try {
      // Implement auto-updater logic here
      // For now, just return current version
      const { app } = require('electron');
      return {
        success: true,
        currentVersion: app.getVersion(),
        updateAvailable: false,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get logs
  ipcMain.handle('get-logs', async (event, lines = 100) => {
    try {
      const agentManager = global.agentManager;
      if (!agentManager) {
        return { success: false, error: 'Agent not initialized' };
      }

      const logs = agentManager.getLogs(lines);
      return { success: true, logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Export data
  ipcMain.handle('export-data', async (event, dataType) => {
    try {
      const agentManager = global.agentManager;
      if (!agentManager) {
        return { success: false, error: 'Agent not initialized' };
      }

      const data = await agentManager.exportData(dataType);
      
      // Show save dialog
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: `Export ${dataType}`,
        defaultPath: `${dataType}-export-${Date.now()}.json`,
        filters: [
          { name: 'JSON', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (filePath) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return { success: true, filePath };
      }

      return { success: false, error: 'Export cancelled' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Minimize to tray
  ipcMain.handle('minimize-to-tray', async () => {
    try {
      mainWindow.hide();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Show window
  ipcMain.handle('show-window', async () => {
    try {
      mainWindow.show();
      mainWindow.focus();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  console.log('✓ IPC handlers initialized');
}

module.exports = { initializeIpcHandlers };
