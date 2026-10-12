import React, { useState } from 'react';
import BillCard from './BillCard';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function BillList({ bills, onDelete, onMarkPaid, onIgnore }) {
  const [expandedMonths, setExpandedMonths] = useState({});

  if (!bills || bills.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-icon">📋</p>
        <p>No bills yet.</p>
        <p className="empty-hint">Add a bill manually or connect Gmail to scan for bills.</p>
      </div>
    );
  }

  const pendingBills = bills.filter(b => b.status === 'pending');
  const paidBills = bills.filter(b => b.status === 'paid');

  // Group paid bills by month
  const paidByMonth = {};
  paidBills.forEach(bill => {
    if (!bill.due_date) return;
    const [year, month] = bill.due_date.split('-');
    const key = `${year}-${month}`;
    if (!paidByMonth[key]) paidByMonth[key] = [];
    paidByMonth[key].push(bill);
  });

  // Sort months newest first
  const sortedMonthKeys = Object.keys(paidByMonth).sort((a, b) => b.localeCompare(a));

  function toggleMonth(key) {
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function getMonthLabel(key) {
    const [year, month] = key.split('-');
    return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
  }

  function getMonthTotal(bills) {
    return bills.reduce((sum, b) => sum + (b.amount || 0), 0);
  }

  return (
    <div className="bill-list">
      {pendingBills.length > 0 && (
        <section>
          <h3 className="section-title">Pending ({pendingBills.length})</h3>
          <div className="bill-grid">
            {pendingBills.map(bill => (
              <BillCard
                key={bill.id}
                bill={bill}
                onDelete={onDelete}
                onMarkPaid={onMarkPaid}
                onIgnore={onIgnore}
              />
            ))}
          </div>
        </section>
      )}

      {sortedMonthKeys.length > 0 && (
        <section>
          <h3 className="section-title paid-title">Paid ({paidBills.length})</h3>
          <div className="paid-months">
            {sortedMonthKeys.map(key => {
              const monthBills = paidByMonth[key];
              const isExpanded = expandedMonths[key];
              const total = getMonthTotal(monthBills);

              return (
                <div key={key} className="paid-month-group">
                  <button
                    className="paid-month-header"
                    onClick={() => toggleMonth(key)}
                    aria-expanded={isExpanded}
                  >
                    <span className={`paid-month-arrow ${isExpanded ? 'expanded' : ''}`}>▶</span>
                    <span className="paid-month-label">{getMonthLabel(key)}</span>
                    <span className="paid-month-count">{monthBills.length} bill(s)</span>
                    <span className="paid-month-total">AUD {total.toFixed(2)}</span>
                  </button>

                  {isExpanded && (
                    <div className="bill-grid paid-month-bills">
                      {monthBills.map(bill => (
                        <BillCard
                          key={bill.id}
                          bill={bill}
                          onDelete={onDelete}
                          onMarkPaid={onMarkPaid}
                          onIgnore={onIgnore}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default BillList;
