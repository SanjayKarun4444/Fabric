import { useState, useEffect } from 'react';

export function useAgentStatus() {
  const [status, setStatus] = useState({
    connected: false,
    activeAgents: [],
    lastUpdate: null
  });

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const result = await window.electronAPI.getAgentStatus();
      if (result.success) {
        setStatus({
          connected: true,
          activeAgents: result.status.active_agents || [],
          lastUpdate: new Date()
        });
      } else {
        setStatus(prev => ({ ...prev, connected: false }));
      }
    } catch (error) {
      setStatus(prev => ({ ...prev, connected: false }));
    }
  };

  return status;
}
