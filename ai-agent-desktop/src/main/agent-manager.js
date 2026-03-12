const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const WebSocket = require('ws');

class AgentManager {
  constructor() {
    this.pythonProcess = null;
    this.backendUrl = `http://${process.env.BACKEND_HOST || '127.0.0.1'}:${process.env.BACKEND_PORT || 3001}`;
    this.wsUrl = `ws://${process.env.BACKEND_HOST || '127.0.0.1'}:${process.env.BACKEND_PORT || 3001}/ws`;
    this.isReady = false;
    this.logs = [];
    this.maxLogs = 1000;
    this.retryAttempts = 3;
    this.retryDelay = 5000;
    this.ws = null;
    this.wsReconnectTimer = null;
    this.mainWindow = null; // set by main.js after window creation
  }

  async start() {
    console.log('Starting Python backend...');

    // If backend is already running (e.g. manually started), skip spawning
    try {
      const response = await axios.get(`${this.backendUrl}/health`, { timeout: 2000 });
      if (response.data?.status === 'healthy') {
        this.isReady = true;
        console.log('✓ Python backend already running, skipping spawn');
        this.connectWebSocket(); // still need the WS connection
        return;
      }
    } catch (_) {}

    // Determine Python executable
    const pythonExecutable = this.findPythonExecutable();
    if (!pythonExecutable) {
      throw new Error('Python not found. Please install Python 3.8+');
    }

    // Determine script path
    const scriptPath = this.findBackendScript();
    if (!scriptPath) {
      throw new Error('Backend script not found');
    }

    // Check if virtual environment exists
    const venvPath = path.join(path.dirname(scriptPath), '..', 'venv');
    const venvPython = this.getVenvPython(venvPath);

    // Use venv python if available, otherwise system python
    const pythonPath = venvPython || pythonExecutable;

    console.log(`Using Python: ${pythonPath}`);
    console.log(`Backend script: ${scriptPath}`);

    // Spawn Python process
    this.pythonProcess = spawn(pythonPath, [scriptPath], {
      env: {
        ...process.env,
        ELECTRON_MODE: 'true',
        PYTHONUNBUFFERED: '1',
      },
      cwd: path.dirname(scriptPath),
    });

    // Handle stdout
    this.pythonProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      console.log(`[Python] ${message}`);
      this.addLog('info', message);

      // Check if backend is ready
      if (message.includes('Uvicorn running') || message.includes('Application startup complete')) {
        this.isReady = true;
        console.log('✓ Python backend ready');
      }
    });

    // Handle stderr
    this.pythonProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      console.error(`[Python Error] ${message}`);
      this.addLog('error', message);
    });

    // Handle process exit
    this.pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      this.isReady = false;
      this.addLog('warning', `Backend process exited with code ${code}`);

      // Auto-restart if not intentional shutdown
      if (code !== 0 && code !== null && this.retryAttempts > 0) {
        console.log(`Restarting backend in ${this.retryDelay / 1000}s...`);
        this.retryAttempts--;
        setTimeout(() => {
          this.start().catch(console.error);
        }, this.retryDelay);
      }
    });

    // Wait for backend to be ready
    await this.waitForBackend();
    // Connect WebSocket for real-time agent events
    this.connectWebSocket();
  }

  async waitForBackend(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(`${this.backendUrl}/health`, {
          timeout: 5000,
        });
        
        if (response.data.status === 'healthy') {
          this.isReady = true;
          return true;
        }
      } catch (error) {
        // Backend not ready yet, wait and retry
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Backend failed to start within timeout period');
  }

  async executeCommand(command, args = {}) {
    if (!this.isReady) {
      return { success: false, error: 'Backend not ready' };
    }

    try {
      const response = await axios.post(
        `${this.backendUrl}/agent/execute`,
        { command, args },
        { timeout: 60000 } // 60 second timeout
      );

      this.addLog('info', `Command executed: ${command}`);
      return response.data;
    } catch (error) {
      this.addLog('error', `Command failed: ${command} - ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  async getStatus() {
    if (!this.isReady) {
      return { connected: false, error: 'Backend not ready' };
    }

    try {
      const response = await axios.get(`${this.backendUrl}/agent/status`, {
        timeout: 5000,
      });

      return { connected: true, ...response.data };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async exportData(dataType) {
    try {
      const response = await axios.get(
        `${this.backendUrl}/agent/export/${dataType}`,
        { timeout: 30000 }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  getLogs(lines = 100) {
    return this.logs.slice(-lines);
  }

  addLog(level, message) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    this.logs.push(log);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log(`[AgentManager] WebSocket connected to ${this.wsUrl}`);
        this.addLog('info', 'WebSocket connected');
        if (this.wsReconnectTimer) {
          clearTimeout(this.wsReconnectTimer);
          this.wsReconnectTimer = null;
        }
        // Notify renderer that WS is live
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('agent-update', { type: 'ws_connected' });
        }
      });

      this.ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          // Forward to renderer window via IPC
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('agent-update', msg);
          }
        } catch (_) {}
      });

      this.ws.on('close', () => {
        console.log('WebSocket disconnected — reconnecting in 3s...');
        this.ws = null;
        if (this.isReady) {
          this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), 3000);
        }
      });

      this.ws.on('error', (err) => {
        console.error(`WebSocket error: ${err.message}`);
        this.ws = null;
      });
    } catch (err) {
      console.error(`WebSocket connect failed: ${err.message}`);
    }
  }

  sendWsMessage(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    // WS not open — kick off a reconnect so the next message works
    const state = this.ws ? ['CONNECTING','OPEN','CLOSING','CLOSED'][this.ws.readyState] : 'null';
    console.warn(`[AgentManager] WS not open (state: ${state}) — triggering reconnect`);
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connectWebSocket();
    }
    return false;
  }

  stop() {
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pythonProcess) {
      console.log('Stopping Python backend...');
      this.pythonProcess.kill();
      this.pythonProcess = null;
      this.isReady = false;
    }
  }

  findPythonExecutable() {
    const possibleNames = ['python3', 'python'];
    
    for (const name of possibleNames) {
      try {
        const { execSync } = require('child_process');
        execSync(`${name} --version`, { stdio: 'ignore' });
        return name;
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  findBackendScript() {
    // Check if packaged (production)
    if (process.resourcesPath) {
      const packagedPath = path.join(
        process.resourcesPath,
        'python-backend',
        'desktop_server.py'
      );
      if (fs.existsSync(packagedPath)) {
        return packagedPath;
      }
    }

    // Development paths
    const devPaths = [
      path.join(__dirname, '../../python-backend/desktop_server.py'),
      path.join(process.cwd(), 'python-backend/desktop_server.py'),
    ];

    for (const devPath of devPaths) {
      if (fs.existsSync(devPath)) {
        return devPath;
      }
    }

    return null;
  }

  getVenvPython(venvPath) {
    if (!fs.existsSync(venvPath)) {
      return null;
    }

    const possiblePaths = [
      path.join(venvPath, 'bin', 'python'),     // Unix
      path.join(venvPath, 'Scripts', 'python.exe'), // Windows
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }
}

module.exports = { AgentManager };
