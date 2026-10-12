// Backend URL - uses Railway in production, localhost in dev
const BACKEND = import.meta.env.VITE_API_URL || '';
const API_BASE = `${BACKEND}/api`;
const AUTH_BASE = `${BACKEND}/auth`;

export async function triggerScan(days = 30) {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Scan failed');
  }
  return res.json();
}

export async function getAuthStatus() {
  const res = await fetch(`${AUTH_BASE}/status`);
  if (!res.ok) throw new Error('Failed to check auth status');
  return res.json();
}

export async function testTelegram() {
  const res = await fetch(`${API_BASE}/test-telegram`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Telegram test failed');
  }
  return res.json();
}

export { BACKEND, API_BASE, AUTH_BASE };
