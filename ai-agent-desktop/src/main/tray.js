const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { showNotification } = require('./notifications');

function createTray(mainWindow, store) {
  // Load icon
  const iconPath = path.join(__dirname, '../../assets/icon-tray.png');
  let trayIcon;
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    // Resize for tray (16x16 on macOS, 32x32 on Windows)
    if (process.platform === 'darwin') {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } catch (error) {
    console.error('Failed to load tray icon:', error);
    // Use a simple emoji as fallback
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  }

  const tray = new Tray(trayIcon);
  
  // Set tooltip
  tray.setToolTip('AI Agent Suite');

  // Create initial context menu
  updateTrayMenu(tray, mainWindow, null, store);

  // Click to show window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  return tray;
}

function updateTrayMenu(tray, mainWindow, agentManager, store) {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quick Actions',
      submenu: [
        {
          label: '📧 Triage Inbox',
          click: async () => {
            if (agentManager) {
              showNotification('Email Triage', 'Starting email triage...');
              const result = await agentManager.executeCommand('triage_inbox');
              if (result.success) {
                showNotification('Email Triage Complete', result.result.summary || 'Done!');
              }
            }
          },
        },
        {
          label: '📋 Today\'s Summary',
          click: async () => {
            if (agentManager) {
              const result = await agentManager.executeCommand('daily_summary');
              if (result.success) {
                showNotification('Daily Summary', result.result.summary || 'Check dashboard for details');
                if (mainWindow) {
                  mainWindow.show();
                  mainWindow.webContents.send('navigate-to', 'dashboard');
                }
              }
            }
          },
        },
        {
          label: '✅ Check Tasks',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('navigate-to', 'tasks');
            }
          },
        },
        { type: 'separator' },
        {
          label: '🌅 Run Morning Routine',
          click: async () => {
            if (agentManager) {
              showNotification('Morning Routine', 'Starting morning routine...');
              const result = await agentManager.executeCommand('morning_routine');
              if (result.success) {
                showNotification('Morning Routine Complete', 'Your day is ready!');
              }
            }
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Preferences',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('navigate-to', 'settings');
        }
      },
    },
    {
      label: agentManager ? '🟢 Agent Connected' : '🔴 Agent Disconnected',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        const { app } = require('electron');
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

module.exports = { createTray, updateTrayMenu };
