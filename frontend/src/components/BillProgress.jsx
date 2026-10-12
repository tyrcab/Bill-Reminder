import React, { useMemo } from 'react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function BillProgress({ bills }) {
  const { paid, total, percent, monthName } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Only include bills due within the current calendar month (1st to last day)
    const monthBills = bills.filter(b => {
      if (!b.due_date) return false;
      const [y, m] = b.due_date.split('-');
      return parseInt(y) === currentYear && parseInt(m) - 1 === currentMonth;
    });

    const paidCount = monthBills.filter(b => b.status === 'paid').length;
    const totalCount = monthBills.length;
    const pct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

    return { paid: paidCount, total: totalCount, percent: pct, monthName: MONTH_NAMES[currentMonth] };
  }, [bills]);

  if (total === 0) return null;

  return (
    <div className="bill-progress">
      <div className="progress-header">
        <span className="progress-label">{monthName} Progress</span>
        <span className="progress-count">{paid} of {total} paid</span>
      </div>
      <div className="progress-bar-bg">
        <div
          className="progress-bar-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent === 100 && (
        <span className="progress-complete">All {monthName} bills paid! 🎉</span>
      )}
    </div>
  );
}

export default BillProgress;
