import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, doc, deleteDoc } from '../firebase';
import { PinSetup } from './PinLock';
import { BACKEND } from '../api';

function GmailStatus() {
  const [status, setStatus] = useState({ authenticated: false, email: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/auth/status`)
      .then(r => r.json())
      .then(data => setStatus(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="settings-desc">Checking connection...</p>;

  if (status.authenticated && status.email) {
    return (
      <div className="gmail-status connected">
        <span className="gmail-status-dot" />
        <span>Connected: <strong>{status.email}</strong></span>
      </div>
    );
  }

  if (status.authenticated && !status.email) {
    return (
      <div className="gmail-status warning">
        <span className="gmail-status-dot warning" />
        <span>Token exists but may be invalid. Try reconnecting.</span>
      </div>
    );
  }

  return (
    <div className="gmail-status disconnected">
      <span className="gmail-status-dot disconnected" />
      <span>Not connected</span>
    </div>
  );
}

function Settings({ bills, onBack, user, logout, isAdmin, pushEnabled, pushSupported, enablePush, disablePush }) {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [includeProcessed, setIncludeProcessed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [ignoredList, setIgnoredList] = useState([]);
  const [loadingIgnored, setLoadingIgnored] = useState(true);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramResult, setTelegramResult] = useState(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const hasPin = !!localStorage.getItem('app_pin');

  useEffect(() => {
    loadIgnoredList();
  }, []);

  async function loadIgnoredList() {
    try {
      const snapshot = await getDocs(collection(db, 'ignored_senders'));
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setIgnoredList(items);
    } catch (err) {
      console.error('Failed to load ignored list:', err);
    } finally {
      setLoadingIgnored(false);
    }
  }

  async function handleCustomScan() {
    setScanning(true);
    setScanResult(null);
    setError(null);

    try {
      const start = new Date(startDate);
      const today = new Date();
      const daysBack = Math.ceil((today - start) / (1000 * 60 * 60 * 24));

      const res = await fetch(`${BACKEND}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: daysBack, include_processed: includeProcessed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Scan failed');
      }

      const result = await res.json();
      setScanResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  async function handleRemoveIgnored(id) {
    try {
      await deleteDoc(doc(db, 'ignored_senders', id));
      setIgnoredList(ignoredList.filter(i => i.id !== id));
    } catch (err) {
      setError('Failed to remove: ' + err.message);
    }
  }

  async function handleTestTelegram() {
    setTestingTelegram(true);
    setTelegramResult(null);
    try {
      const res = await fetch(`${BACKEND}/api/test-telegram`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      setTelegramResult('Test message sent to Telegram!');
    } catch (err) {
      setTelegramResult('Error: ' + err.message);
    } finally {
      setTestingTelegram(false);
    }
  }

  async function handleDisconnectGmail() {
    if (!confirm('Disconnect Gmail? You can reconnect anytime.')) return;
    setDisconnecting(true);
    try {
      await fetch(`${BACKEND}/auth/disconnect`, { method: 'POST' });
    } catch {
      // OK even if backend is down
    }
    setDisconnecting(false);
  }

  function handleExportCSV() {
    const headers = ['Description', 'Amount', 'Due Date', 'Category', 'Status', 'Recurrence', 'Source'];
    const rows = bills.map(b => [
      b.description,
      b.amount?.toFixed(2) || '0.00',
      b.due_date,
      b.category || 'other',
      b.status,
      b.recurrence || 'none',
      b.source || 'manual',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bills_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleClearPaid() {
    const paidBills = bills.filter(b => b.status === 'paid');
    if (paidBills.length === 0) {
      alert('No paid bills to clear.');
      return;
    }
    if (!confirm(`Delete ${paidBills.length} paid bill(s)? This cannot be undone.`)) return;

    try {
      for (const bill of paidBills) {
        await fetch(`${BACKEND}/api/bills/${bill.id}`, { method: 'DELETE' });
      }
      alert(`${paidBills.length} paid bills cleared.`);
    } catch (err) {
      setError('Failed to clear paid bills: ' + err.message);
    }
  }

  function handleRemovePin() {
    if (confirm('Remove PIN lock? Anyone with access to your device can open the app.')) {
      localStorage.removeItem('app_pin');
      setShowPinSetup(false);
    }
  }

  return (
    <div className="settings">
      <div className="settings-header">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <h2>Settings</h2>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Account */}
      <div className="settings-card">
        <h3>👤 Account</h3>
        <div className="account-info">
          <img
            src={user?.photoURL || ''}
            alt=""
            className="account-avatar"
          />
          <div className="account-details">
            <span className="account-name">{user?.displayName || 'User'}</span>
            <span className="account-email">{user?.email || ''}</span>
          </div>
        </div>
        <div className="account-actions">
          <button className="btn btn-secondary" onClick={logout}>
            🚪 Sign Out
          </button>
        </div>
      </div>

      {/* Gmail Connection - Admin only */}
      {isAdmin && (
      <div className="settings-card">
        <h3>📧 Gmail Connection</h3>
        <p className="settings-desc">Manage your connected Gmail account for bill scanning.</p>
        <GmailStatus />
        <div className="account-actions">
          <button
            className="btn btn-primary"
            onClick={() => { window.location.href = `${BACKEND}/auth/google`; }}
          >
            🔗 Connect / Switch Gmail
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDisconnectGmail}
            disabled={disconnecting}
          >
            {disconnecting ? '⏳...' : '✕ Disconnect Gmail'}
          </button>
        </div>
      </div>
      )}

      {/* PIN Lock */}
      <div className="settings-card">
        <h3>🔒 PIN Lock</h3>
        <p className="settings-desc">
          {hasPin
            ? 'PIN lock is enabled. You\'ll be asked for your PIN when opening the app.'
            : 'Add a 4-digit PIN for extra security when opening the app.'
          }
        </p>

        {showPinSetup ? (
          <PinSetup onComplete={() => setShowPinSetup(false)} />
        ) : (
          <div className="account-actions">
            {hasPin ? (
              <>
                <button className="btn btn-primary" onClick={() => setShowPinSetup(true)}>
                  🔄 Change PIN
                </button>
                <button className="btn btn-danger" onClick={handleRemovePin}>
                  ✕ Remove PIN
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowPinSetup(true)}>
                🔒 Set PIN
              </button>
            )}
          </div>
        )}
      </div>

      {/* Push Notifications */}
      {pushSupported && (
      <div className="settings-card">
        <h3>🔔 Push Notifications</h3>
        <p className="settings-desc">
          {pushEnabled
            ? 'Push notifications are enabled. You\'ll receive alerts when bills are added or due.'
            : 'Enable push notifications to get alerts on your device when bills are due or added.'
          }
        </p>
        <div className="account-actions">
          {pushEnabled ? (
            <button className="btn btn-secondary" onClick={disablePush}>
              🔕 Disable Notifications
            </button>
          ) : (
            <button className="btn btn-primary" onClick={enablePush}>
              🔔 Enable Notifications
            </button>
          )}
        </div>
      </div>
      )}

      {/* Custom Date Range Scan - Admin only */}
      {isAdmin && (
      <div className="settings-card">
        <h3>📧 Custom Gmail Scan</h3>
        <p className="settings-desc">Scan Gmail for bills within a specific date range. Use this to backfill older bills.</p>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startDate">From</label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="endDate">To</label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={includeProcessed}
              onChange={e => setIncludeProcessed(e.target.checked)}
            />
            Include already processed emails (re-scan old bills)
          </label>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleCustomScan}
          disabled={scanning}
        >
          {scanning ? '⏳ Scanning...' : '🔍 Scan Date Range'}
        </button>

        {scanResult && (
          <div className="scan-result" style={{ marginTop: '0.75rem' }}>
            Found {scanResult.new_bills} new bill(s) from {scanResult.scanned} emails scanned.
          </div>
        )}
      </div>
      )}

      {/* Telegram Test */}
      <div className="settings-card">
        <h3>📱 Telegram</h3>
        <p className="settings-desc">Send a test message to verify your Telegram bot is working.</p>
        <button
          className="btn btn-primary"
          onClick={handleTestTelegram}
          disabled={testingTelegram}
        >
          {testingTelegram ? '⏳ Sending...' : '🔔 Send Test Message'}
        </button>
        {telegramResult && (
          <p className="settings-result">{telegramResult}</p>
        )}
      </div>

      {/* Managed Ignored Senders */}
      <div className="settings-card">
        <h3>🚫 Ignored Senders</h3>
        <p className="settings-desc">Bills matching these patterns will be skipped during Gmail scans.</p>

        {loadingIgnored ? (
          <p>Loading...</p>
        ) : ignoredList.length === 0 ? (
          <p className="settings-empty">No ignored senders yet.</p>
        ) : (
          <div className="ignored-list">
            {ignoredList.map(item => (
              <div key={item.id} className="ignored-item">
                <span className="ignored-name">{item.description || item.pattern}</span>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleRemoveIgnored(item.id)}
                  title="Remove from ignore list"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="settings-card">
        <h3>📥 Export Bills</h3>
        <p className="settings-desc">Download all your bills as a CSV file.</p>
        <button className="btn btn-primary" onClick={handleExportCSV}>
          📄 Export CSV
        </button>
      </div>

      {/* Clear Paid Bills */}
      <div className="settings-card">
        <h3>🧹 Clear Paid Bills</h3>
        <p className="settings-desc">Remove all bills marked as paid. This cannot be undone.</p>
        <button className="btn btn-danger" onClick={handleClearPaid}>
          🗑️ Clear All Paid Bills
        </button>
      </div>
    </div>
  );
}

export default Settings;
