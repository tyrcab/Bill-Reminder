import React, { useState } from 'react';
import { BILL_CATEGORIES } from '../utils/categories';

function AddBillForm({ onSubmit, onCancel }) {
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [recurrence, setRecurrence] = useState('none');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || !dueDate || !description) return;

    setSubmitting(true);
    try {
      await onSubmit({
        amount: parseFloat(amount),
        due_date: dueDate,
        description,
        category,
        recurrence,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="add-bill-form" onSubmit={handleSubmit}>
      <h3>Add New Bill</h3>

      <div className="form-group">
        <label htmlFor="description">Bill Description</label>
        <input
          id="description"
          type="text"
          placeholder="e.g. Gas Bill May - July 2026"
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="amount">Amount (AUD)</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="dueDate">Due Date</label>
          <input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {BILL_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="recurrence">Recurrence</label>
          <select
            id="recurrence"
            value={recurrence}
            onChange={e => setRecurrence(e.target.value)}
          >
            <option value="none">One-off (no repeat)</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Adding...' : '💾 Add Bill'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default AddBillForm;
