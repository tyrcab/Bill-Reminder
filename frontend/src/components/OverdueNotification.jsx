import React, { useState } from 'react';
import { editBill } from '../hooks/useBills';

function OverdueNotification({ bills }) {
  const [rescheduling, setRescheduling] = useState(null);
  const [newDate, setNewDate] = useState('');

  // Find bills that are 1+ day past due
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueBills = bills.filter(bill => {
    if (bill.status !== 'pending') return false;
    const dueDate = new Date(bill.due_date + 'T00:00:00');
    const daysPast = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    return daysPast >= 1;
  });

  if (overdueBills.length === 0) return null;

  async function handleMarkPaid(id) {
    await editBill(id, { status: 'paid' });
  }

  async function handleReschedule(id) {
    if (!newDate) return;
    await editBill(id, { due_date: newDate });
    setRescheduling(null);
    setNewDate('');
  }

  return (
    <div className="overdue-notification">
      <div className="overdue-header">
        <span>⚠️</span>
        <strong>Overdue Bills ({overdueBills.length})</strong>
      </div>
      <p className="overdue-subtitle">These bills are past due. Mark as paid or reschedule.</p>

      {overdueBills.map(bill => (
        <div key={bill.id} className="overdue-item">
          <div className="overdue-info">
            <span className="overdue-desc">{bill.description}</span>
            <span className="overdue-amount">AUD {bill.amount.toFixed(2)}</span>
          </div>

          {rescheduling === bill.id ? (
            <div className="overdue-reschedule">
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                aria-label="New due date"
              />
              <button className="btn btn-sm btn-primary" onClick={() => handleReschedule(bill.id)}>
                Save
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => setRescheduling(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="overdue-actions">
              <button className="btn btn-sm btn-success" onClick={() => handleMarkPaid(bill.id)}>
                ✓ Paid
              </button>
              <button className="btn btn-sm btn-reschedule" onClick={() => setRescheduling(bill.id)}>
                📅 Reschedule
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default OverdueNotification;
