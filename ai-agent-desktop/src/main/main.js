const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const schedule = require('node-schedule');

// Import modules
const { createTray, updateTrayMenu } = require('./tray');
const { initializeIpcHandlers } = require('./ipc-handlers');
const { AgentManager } = require('./agent-manager');
const { showNotification } = require('./notifications');

// Initialize settings store
const store = new Store({
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    theme: 'dark',
    autoLaunch: false,
    notifications: {
      email: true,
      calendar: true,
      tasks: true,
    },
    schedules: {
      morningRoutine: '07:00',
      eveningRoutine: '18:00',
      emailCheck: 15, // minutes
    }
  }
});

// Global references
let mainWindow;
let tray;
let agentManager;
let scheduledJobs = {};

// Create main window
function createWindow() {
  const windowBounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Save window bounds on resize
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  });

  // Hide instead of close (keep running in background)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show notification on first hide
      if (!store.get('hasSeenBackgroundNotice')) {
        showNotification(
          'AI Agent Suite',
          'App minimized to system tray. Right-click the tray icon for options.'
        );
        store.set('hasSeenBackgroundNotice', true);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// Initialize scheduled tasks
function initializeScheduledTasks() {
  const schedules = store.get('schedules');

  // Clear existing jobs
  Object.values(scheduledJobs).forEach(job => job.cancel());
  scheduledJobs = {};

  // Morning routine
  if (schedules.morningRoutine) {
    const [hour, minute] = schedules.morningRoutine.split(':');
    scheduledJobs.morning = schedule.scheduleJob(
      { hour: parseInt(hour), minute: parseInt(minute) },
      async () => {
        console.log('Running morning routine...');
        const result = await agentManager.executeCommand('morning_routine');
        
        if (result.success) {
          showNotification('Good Morning!', result.result.summary || 'Your day is ready.');
          mainWindow?.webContents.send('agent-update', {
            type: 'morning_routine',
            data: result.result
          });
        }
      }
    );
  }

  // Evening routine
  if (schedules.eveningRoutine) {
    const [hour, minute] = schedules.eveningRoutine.split(':');
    scheduledJobs.evening = schedule.scheduleJob(
      { hour: parseInt(hour), minute: parseInt(minute) },
      async () => {
        console.log('Running evening routine...');
        const result = await agentManager.executeCommand('evening_routine');
        
        if (result.success) {
          showNotification('Day Complete!', result.result.summary || 'Great work today!');
          mainWindow?.webContents.send('agent-update', {
            type: 'evening_routine',
            data: result.result
          });
        }
      }
    );
  }

  // Email check interval
  if (schedules.emailCheck) {
    const intervalMinutes = schedules.emailCheck;
    const rule = new schedule.RecurrenceRule();
    rule.minute = new schedule.Range(0, 59, intervalMinutes);

    scheduledJobs.emailCheck = schedule.scheduleJob(rule, async () => {
      console.log('Checking emails...');
      const result = await agentManager.executeCommand('check_new_emails');
      
      if (result.success && result.result.urgent > 0) {
        const notifSettings = store.get('notifications');
        if (notifSettings.email) {
          showNotification(
            'Urgent Emails',
            `You have ${result.result.urgent} urgent email${result.result.urgent > 1 ? 's' : ''}`
          );
        }
        
        mainWindow?.webContents.send('agent-update', {
          type: 'new_emails',
          data: result.result
        });
      }
    });
  }

  console.log('✓ Scheduled tasks initialized');
}

// App lifecycle
app.whenReady().then(async () => {
  console.log('🚀 AI Agent Suite starting...');

  // Create main window
  createWindow();

  // Create system tray
  tray = createTray(mainWindow, store);

  // Initialize IPC handlers
  initializeIpcHandlers(mainWindow, store);

  // Start agent manager
  agentManager = new AgentManager();
  await agentManager.start();
  console.log('✓ Agent manager started');

  // Make agentManager available to IPC handlers
  global.agentManager = agentManager;

  // Initialize scheduled tasks
  initializeScheduledTasks();

  // Update tray with agent status
  updateTrayMenu(tray, mainWindow, agentManager, store);

  console.log('✓ AI Agent Suite ready!');
});

app.on('window-all-closed', () => {
  // On macOS, keep running in background
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  
  // Cancel scheduled jobs
  Object.values(scheduledJobs).forEach(job => job.cancel());
  
  // Stop agent manager
  if (agentManager) {
    agentManager.stop();
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  showNotification('Error', 'An unexpected error occurred. Check logs for details.');
});

// Export for testing
module.exports = { createWindow, store };
