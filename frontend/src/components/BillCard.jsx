import React, { useState } from 'react';
import { notifyBill, editBill } from '../hooks/useBills';
import { BILL_CATEGORIES, getCategoryById, detectCategory } from '../utils/categories';
import { useToast } from './Toast';

function BillCard({ bill, onDelete, onMarkPaid, onIgnore }) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const { showToast } = useToast();

  const dueDate = new Date(bill.due_date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0 && bill.status === 'pending';
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3 && bill.status === 'pending';

  const currentCategory = getCategoryById(bill.category || detectCategory(bill.description));

  function getDueLabel() {
    if (bill.status === 'paid') return 'Paid';
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    if (isOverdue) return `${Math.abs(daysUntilDue)} days overdue`;
    return `Due in ${daysUntilDue} days`;
  }

  function getCardClass() {
    let cls = 'bill-card';
    if (bill.status === 'paid') cls += ' bill-paid';
    else if (isOverdue) cls += ' bill-overdue';
    else if (isDueSoon) cls += ' bill-due-soon';
    return cls;
  }

  async function handleNotify() {
    try {
      await notifyBill(bill.id);
      showToast('Telegram notification sent!', 'success');
    } catch (err) {
      showToast('Failed to send notification: ' + err.message, 'error');
    }
  }

  function handleIgnore() {
    if (confirm(`Ignore future emails like "${bill.description}"?\n\nThis bill will be deleted and similar emails won't be scanned again.`)) {
      onIgnore(bill);
      showToast('Bill ignored. Future similar emails will be skipped.', 'info');
    }
  }

  async function handleCategoryChange(newCategory) {
    setShowCategoryPicker(false);
    try {
      await editBill(bill.id, { category: newCategory });
      showToast(`Category updated to ${getCategoryById(newCategory).label}`, 'success');
    } catch (err) {
      showToast('Failed to update category: ' + err.message, 'error');
    }
  }

  const formattedDate = dueDate.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className={getCardClass()}>
      <div className="bill-card-header">
        <span className="bill-source">{bill.source === 'gmail' ? '📧' : '✏️'}</span>
        <button
          className="bill-category-badge clickable"
          onClick={() => setShowCategoryPicker(!showCategoryPicker)}
          title={`Category: ${currentCategory.label} (click to change)`}
        >
          {currentCategory.icon} {currentCategory.label}
        </button>
        <span className={`bill-due-badge ${isOverdue ? 'overdue' : isDueSoon ? 'soon' : ''}`}>
          {getDueLabel()}
        </span>
      </div>

      {showCategoryPicker && (
        <div className="category-picker">
          {BILL_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-option ${cat.id === currentCategory.id ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat.id)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      )}

      <h4 className="bill-description">
        {bill.description}
        {bill.recurrence && bill.recurrence !== 'none' && (
          <span className="bill-recurrence">🔁 {bill.recurrence}</span>
        )}
      </h4>

      <div className="bill-details">
        <div className="bill-amount">
          <span className="label">💰 Amount</span>
          <span className="value">AUD {bill.amount.toFixed(2)}</span>
        </div>
        <div className="bill-date">
          <span className="label">📅 Due</span>
          <span className="value">{formattedDate}</span>
        </div>
      </div>

      <div className="bill-actions">
        {bill.status === 'pending' && (
          <>
            <button
              className="btn btn-sm btn-success"
              onClick={() => onMarkPaid(bill.id)}
              title="Mark as paid"
            >
              ✓ Paid
            </button>
            <button
              className="btn btn-sm btn-notify"
              onClick={handleNotify}
              title="Send Telegram notification"
            >
              📱 Notify
            </button>
          </>
        )}
        {bill.status === 'paid' && (
          <button
            className="btn btn-sm btn-unpaid"
            onClick={() => onMarkPaid(bill.id, 'pending')}
            title="Mark as unpaid"
          >
            ↩ Unpaid
          </button>
        )}
        {bill.source === 'gmail' && (
          <button
            className="btn btn-sm btn-ignore"
            onClick={handleIgnore}
            title="Ignore future emails like this"
          >
            🚫
          </button>
        )}
        <button
          className="btn btn-sm btn-danger"
          onClick={() => onDelete(bill.id)}
          title="Delete bill"
        >
          🗑️
        </button>
      </div>
    </article>
  );
}

export default BillCard;
