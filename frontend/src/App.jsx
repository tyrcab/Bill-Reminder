import React, { useState, useEffect, useMemo } from 'react';
import BillList from './components/BillList';
import AddBillForm from './components/AddBillForm';
import Header from './components/Header';
import OverdueNotification from './components/OverdueNotification';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import LoadingSkeleton from './components/LoadingSkeleton';
import BillProgress from './components/BillProgress';
import Confetti from './components/Confetti';
import { useBills, addBill, removeBill, editBill, ignoreBill } from './hooks/useBills';
import { useDarkMode } from './hooks/useDarkMode';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useToast } from './components/Toast';
import { downloadICS } from './utils/icsExport';
import { BACKEND } from './api';

function App({ user, logout, isAdmin }) {
  const { bills, loading, error: billsError } = useBills();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { showToast } = useToast();
  const { pushEnabled, pushSupported, enablePush, disablePush } = usePushNotifications(user, showToast);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [billsYear, setBillsYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (billsError) setError(billsError);
  }, [billsError]);

  // Check if all bills for current month are paid → trigger confetti
  useEffect(() => {
    if (!bills.length) return;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthBills = bills.filter(b => {
      if (!b.due_date) return false;
      const [y, m] = b.due_date.split('-');
      return parseInt(y) === currentYear && parseInt(m) - 1 === currentMonth;
    });

    if (monthBills.length > 0 && monthBills.every(b => b.status === 'paid')) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 100);
    }
  }, [bills]);

  async function checkAuth() {
    try {
      const res = await fetch(`${BACKEND}/auth/status`);
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(data.authenticated);
      }
    } catch {
      // Backend not running
    }
  }

  async function handleAddBill(bill) {
    try {
      await addBill(bill);
      setShowAddForm(false);
      showToast('Bill added successfully!', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteBill(id) {
    try {
      await removeBill(id);
      showToast('Bill deleted', 'info');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleIgnoreBill(bill) {
    try {
      await ignoreBill(bill);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMarkPaid(id, status = 'paid') {
    try {
      await editBill(id, { status });
      showToast(status === 'paid' ? 'Bill marked as paid!' : 'Bill marked as unpaid', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSyncFamilyWall() {
    const success = downloadICS(bills);
    if (success) {
      showToast('Bills exported! Import the .ics file into FamilyWall calendar.', 'success', 5000);
    } else {
      showToast('No pending bills to export.', 'info');
    }
  }

  async function handleScan() {
    try {
      setScanning(true);
      setScanResult(null);
      const res = await fetch(`${BACKEND}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Scan failed');
      }
      const result = await res.json();
      setScanResult(result);
      showToast(`Scan complete: ${result.new_bills} new bill(s) found`, 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  // Filtered bills for search
  const filteredBills = useMemo(() => {
    if (searchQuery.trim()) {
      // When searching, show results from all years
      const q = searchQuery.toLowerCase();
      return bills.filter(b =>
        (b.description || '').toLowerCase().includes(q) ||
        (b.category || '').toLowerCase().includes(q) ||
        String(b.amount).includes(q)
      );
    }
    // When not searching, filter by selected year
    return bills.filter(b => b.due_date && b.due_date.startsWith(String(billsYear)));
  }, [bills, billsYear, searchQuery]);

  return (
    <div className="app">
      <Confetti active={showConfetti} />

      <Header
        authenticated={authenticated}
        onScan={handleScan}
        scanning={scanning}
        onSettings={() => setActiveTab('settings')}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        isAdmin={isAdmin}
        onSyncFamilyWall={handleSyncFamilyWall}
      />

      {/* Tab Navigation */}
      {activeTab !== 'settings' && (
        <nav className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`tab-btn ${activeTab === 'bills' ? 'active' : ''}`}
            onClick={() => setActiveTab('bills')}
          >
            📋 Bills
          </button>
        </nav>
      )}

      <main className="main">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">&times;</button>
          </div>
        )}

        {scanResult && activeTab !== 'settings' && (
          <div className="scan-result" role="status">
            Scan complete: {scanResult.scanned} emails checked, {scanResult.new_bills} new bill(s) found
            <button onClick={() => setScanResult(null)} aria-label="Dismiss notification">&times;</button>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="fade-in">
            <Settings bills={bills} onBack={() => setActiveTab('dashboard')} user={user} logout={logout} isAdmin={isAdmin} pushEnabled={pushEnabled} pushSupported={pushSupported} enablePush={enablePush} disablePush={disablePush} />
          </div>
        )}

        {activeTab === 'bills' && (
          <div className="fade-in">
            <div className="actions-bar">
              <h2>Your Bills</h2>
              <div className="actions-right">
                <select
                  className="year-filter"
                  value={billsYear}
                  onChange={e => setBillsYear(parseInt(e.target.value))}
                >
                  {[...new Set(bills.filter(b => b.due_date).map(b => parseInt(b.due_date.split('-')[0])))].sort((a, b) => b - a).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  {showAddForm ? 'Cancel' : '+ Add Bill'}
                </button>
              </div>
            </div>

            <BillProgress bills={bills} />

            {/* Search */}
            <div className="search-bar">
              <div className="search-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search bills by name, category, or amount..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <OverdueNotification bills={bills} />

            {showAddForm && (
              <AddBillForm onSubmit={handleAddBill} onCancel={() => setShowAddForm(false)} />
            )}

            {loading ? (
              <LoadingSkeleton />
            ) : (
              <BillList
                bills={filteredBills}
                onDelete={handleDeleteBill}
                onMarkPaid={handleMarkPaid}
                onIgnore={handleIgnoreBill}
              />
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="fade-in">
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <Dashboard bills={bills} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
