import { useState, useEffect } from 'react';
import {
  db,
  billsCollection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  collection,
} from '../firebase';
import { BACKEND } from '../api';

const API = `${BACKEND}/api`;

/**
 * Real-time hook for bills from Firestore.
 */
export function useBills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(billsCollection, orderBy('due_date', 'asc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const billsData = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        setBills(billsData);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore subscription error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { bills, loading, error };
}

/**
 * Add a new bill directly to Firestore.
 * Also tries to call backend for calendar + telegram (optional).
 */
export async function addBill({ amount, due_date, description, category = 'other', recurrence = 'none' }) {
  // Write directly to Firestore
  const billData = {
    amount: parseFloat(amount),
    due_date,
    description,
    category,
    recurrence,
    source: 'manual',
    status: 'pending',
    email_id: null,
    calendar_event_id: null,
    telegram_sent: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const docRef = await addDoc(billsCollection, billData);

  // Try to notify via backend (calendar + telegram) - non-blocking
  try {
    await fetch(`${API}/bills/notify-new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docRef.id, ...billData }),
    });
  } catch {
    // Backend might not be running - that's fine
  }

  return { id: docRef.id, ...billData };
}

/**
 * Update a bill. Calls backend to handle calendar updates and recurrence.
 */
export async function editBill(id, updates) {
  try {
    await fetch(`${API}/bills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch {
    const billRef = doc(db, 'bills', id);
    await updateDoc(billRef, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function removeBill(id) {
  try {
    await fetch(`${API}/bills/${id}`, { method: 'DELETE' });
  } catch {
    const billRef = doc(db, 'bills', id);
    await deleteDoc(billRef);
  }
}

export async function notifyBill(id) {
  const res = await fetch(`${API}/bills/${id}/notify`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to send notification');
  return res.json();
}

/**
 * Ignore a bill - deletes it and adds to ignore list so it won't be scanned again.
 */
export async function ignoreBill(bill) {
  // Add to ignore list in Firestore
  const ignoreCollection = collection(db, 'ignored_senders');
  await addDoc(ignoreCollection, {
    description: bill.description,
    pattern: bill.description.toLowerCase().replace(/\d+/g, '').trim(),
    created_at: new Date().toISOString(),
  });

  // Delete the bill
  await removeBill(bill.id);
}
