import React from 'react';
import { BACKEND } from '../api';

function Header({ authenticated, onScan, scanning, onSettings, darkMode, toggleDarkMode, isAdmin, onSyncFamilyWall }) {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">
          <span className="header-icon">🔔</span>
          Bill Reminder
        </h1>
        <div className="header-actions">
          {isAdmin && (
            authenticated ? (
              <button
                className="btn btn-scan"
                onClick={onScan}
                disabled={scanning}
              >
                {scanning ? '⏳ Scanning...' : '📧 Scan Gmail'}
              </button>
            ) : (
              <button
                className="btn btn-connect"
                onClick={() => { window.location.href = `${BACKEND}/auth/google`; }}
              >
                🔗 Connect Gmail
              </button>
            )
          )}
          <button
            className="btn btn-sync"
            onClick={onSyncFamilyWall}
            title="Sync bills to FamilyWall (download .ics file)"
          >
            📅 Sync Bills
          </button>
          <button
            className="dark-mode-toggle"
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button
            className="btn btn-settings"
            onClick={onSettings}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
