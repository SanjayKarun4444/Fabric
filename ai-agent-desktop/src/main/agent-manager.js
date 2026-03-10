const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

class AgentManager {
  constructor() {
    this.pythonProcess = null;
    this.backendUrl = `http://${process.env.BACKEND_HOST || '127.0.0.1'}:${process.env.BACKEND_PORT || 3001}`;
    this.isReady = false;
    this.logs = [];
    this.maxLogs = 1000;
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async start() {
    console.log('Starting Python backend...');
    
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

  stop() {
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
