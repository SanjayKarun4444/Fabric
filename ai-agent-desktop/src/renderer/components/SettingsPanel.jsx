import React, { useState, useEffect } from 'react';

function SettingsPanel() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const result = await window.electronAPI.getSettings();
    if (result.success) {
      setSettings(result.settings);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
      alert('Settings saved successfully!');
    } else {
      alert('Failed to save settings: ' + result.error);
    }
    setSaving(false);
  };

  const handleChange = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div className="settings-panel">
      <header className="panel-header">
        <h2>⚙️ Settings</h2>
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </header>

      <div className="settings-content">
        <section className="settings-section">
          <h3>Notifications</h3>
          <div className="setting-item">
            <label>
              <input type="checkbox" checked={settings.notifications?.email || false}
                     onChange={(e) => handleChange('notifications', 'email', e.target.checked)} />
              Email notifications
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input type="checkbox" checked={settings.notifications?.calendar || false}
                     onChange={(e) => handleChange('notifications', 'calendar', e.target.checked)} />
              Calendar notifications
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input type="checkbox" checked={settings.notifications?.tasks || false}
                     onChange={(e) => handleChange('notifications', 'tasks', e.target.checked)} />
              Task notifications
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h3>Schedules</h3>
          <div className="setting-item">
            <label>
              Morning routine time:
              <input type="time" value={settings.schedules?.morningRoutine || '07:00'}
                     onChange={(e) => handleChange('schedules', 'morningRoutine', e.target.value)} />
            </label>
          </div>
          <div className="setting-item">
            <label>
              Evening routine time:
              <input type="time" value={settings.schedules?.eveningRoutine || '18:00'}
                     onChange={(e) => handleChange('schedules', 'eveningRoutine', e.target.value)} />
            </label>
          </div>
          <div className="setting-item">
            <label>
              Email check interval (minutes):
              <input type="number" value={settings.schedules?.emailCheck || 15}
                     onChange={(e) => handleChange('schedules', 'emailCheck', parseInt(e.target.value))}
                     min="5" max="60" />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h3>Appearance</h3>
          <div className="setting-item">
            <label>
              Theme:
              <select value={settings.theme || 'dark'}
                      onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h3>Startup</h3>
          <div className="setting-item">
            <label>
              <input type="checkbox" checked={settings.autoLaunch || false}
                     onChange={(e) => setSettings(prev => ({ ...prev, autoLaunch: e.target.checked }))} />
              Launch on system startup
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SettingsPanel;
