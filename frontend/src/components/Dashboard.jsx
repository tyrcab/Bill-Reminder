import React, { useMemo, useState } from 'react';
import { BILL_CATEGORIES, getCategoryById, detectCategory } from '../utils/categories';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Dashboard({ bills }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredDot, setHoveredDot] = useState(null);
  const [hoveredCategory, setHoveredCategory] = useState(null);

  // Get all years that have bills
  const availableYears = useMemo(() => {
    const years = new Set();
    bills.forEach(b => {
      if (b.due_date) years.add(parseInt(b.due_date.split('-')[0]));
    });
    if (years.size === 0) years.add(currentYear);
    return [...years].sort((a, b) => b - a);
  }, [bills, currentYear]);

  // Filter bills for selected year
  const yearBills = useMemo(() => {
    return bills.filter(b => b.due_date && b.due_date.startsWith(String(selectedYear)));
  }, [bills, selectedYear]);

  // Monthly totals
  const monthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    yearBills.forEach(b => {
      const month = parseInt(b.due_date.split('-')[1]) - 1;
      totals[month] += b.amount || 0;
    });
    return totals;
  }, [yearBills]);

  // Monthly bill counts
  const monthlyCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    yearBills.forEach(b => {
      const month = parseInt(b.due_date.split('-')[1]) - 1;
      counts[month]++;
    });
    return counts;
  }, [yearBills]);

  // Category breakdown
  const categoryTotals = useMemo(() => {
    const totals = {};
    yearBills.forEach(b => {
      const cat = b.category || detectCategory(b.description);
      totals[cat] = (totals[cat] || 0) + (b.amount || 0);
    });
    return Object.entries(totals)
      .map(([id, total]) => ({ ...getCategoryById(id), total }))
      .sort((a, b) => b.total - a.total);
  }, [yearBills]);

  // Running total (cumulative)
  const runningTotals = useMemo(() => {
    let cumulative = 0;
    return monthlyTotals.map(t => { cumulative += t; return cumulative; });
  }, [monthlyTotals]);

  // Insights
  const yearTotal = runningTotals[11] || 0;
  const maxMonthly = Math.max(...monthlyTotals, 1);
  const maxRunning = Math.max(...runningTotals, 1);

  const highestMonth = useMemo(() => {
    let max = 0, idx = 0;
    monthlyTotals.forEach((t, i) => { if (t > max) { max = t; idx = i; } });
    return { month: FULL_MONTHS[idx], amount: max };
  }, [monthlyTotals]);

  const lowestMonth = useMemo(() => {
    // Only consider past completed months (not current or future)
    const pastMonths = monthlyTotals
      .map((t, i) => ({ t, i }))
      .filter(x => x.t > 0 && (selectedYear < currentYear || x.i < currentMonth));
    if (pastMonths.length === 0) return { month: '-', amount: 0 };
    const min = pastMonths.reduce((a, b) => a.t < b.t ? a : b);
    return { month: FULL_MONTHS[min.i], amount: min.t };
  }, [monthlyTotals, currentMonth, currentYear, selectedYear]);

  // Month-over-month change
  const monthChange = useMemo(() => {
    const curr = monthlyTotals[currentMonth] || 0;
    const prev = currentMonth > 0 ? monthlyTotals[currentMonth - 1] : 0;
    if (prev === 0) return null;
    return ((curr - prev) / prev * 100).toFixed(0);
  }, [monthlyTotals, currentMonth]);

  // Upcoming bills this week (Sunday to Saturday)
  const upcomingBills = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get this week's Sunday (start of week)
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);

    // Get this week's Saturday (end of week)
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    return bills
      .filter(b => b.status === 'pending' && b.due_date)
      .filter(b => {
        const d = new Date(b.due_date + 'T00:00:00');
        return d >= sunday && d <= saturday;
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [bills]);

  // Year-over-Year comparison data
  const yoyData = useMemo(() => {
    if (availableYears.length < 2) return null;
    const prevYear = selectedYear - 1;
    if (!availableYears.includes(prevYear)) return null;

    const prevYearBills = bills.filter(b => b.due_date && b.due_date.startsWith(String(prevYear)));
    const prevMonthly = Array(12).fill(0);
    prevYearBills.forEach(b => {
      const month = parseInt(b.due_date.split('-')[1]) - 1;
      prevMonthly[month] += b.amount || 0;
    });

    const prevTotal = prevMonthly.reduce((a, b) => a + b, 0);
    const changePercent = prevTotal > 0 ? ((yearTotal - prevTotal) / prevTotal * 100).toFixed(1) : null;

    return { prevYear, prevMonthly, prevTotal, changePercent };
  }, [bills, selectedYear, availableYears, yearTotal]);

  // Donut chart calculations
  const donutSegments = useMemo(() => {
    if (yearTotal === 0) return [];
    let startAngle = 0;
    return categoryTotals.map(cat => {
      const percent = cat.total / yearTotal;
      const angle = percent * 360;
      const segment = { ...cat, percent, startAngle, angle };
      startAngle += angle;
      return segment;
    });
  }, [categoryTotals, yearTotal]);

  function getDonutPath(startAngle, angle, radius = 80, cx = 100, cy = 100) {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (startAngle + angle - 90) * Math.PI / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(parseInt(e.target.value))}
          className="year-select"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-summary">
        <div className="summary-card">
          <span className="summary-icon">💸</span>
          <span className="summary-label">Year Total</span>
          <span className="summary-value">${yearTotal.toFixed(2)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-icon">📅</span>
          <span className="summary-label">Monthly Avg</span>
          <span className="summary-value">${(yearTotal / (selectedYear < currentYear ? 12 : Math.max(currentMonth, 1))).toFixed(2)}</span>
        </div>
        <div className="summary-card highlight-high">
          <span className="summary-icon">📈</span>
          <span className="summary-label">Highest Month</span>
          <span className="summary-value">${highestMonth.amount.toFixed(0)}</span>
          <span className="summary-sub">{highestMonth.month}</span>
        </div>
        <div className="summary-card highlight-low">
          <span className="summary-icon">📉</span>
          <span className="summary-label">Lowest Month</span>
          <span className="summary-value">${lowestMonth.amount.toFixed(0)}</span>
          <span className="summary-sub">{lowestMonth.month}</span>
        </div>
      </div>

      {/* Month over month + upcoming */}
      <div className="dashboard-row">
        {monthChange !== null && selectedYear === currentYear && (
          <div className="insight-card">
            <span className={`insight-change ${parseInt(monthChange) > 0 ? 'up' : 'down'}`}>
              {parseInt(monthChange) > 0 ? '▲' : '▼'} {Math.abs(monthChange)}%
            </span>
            <span className="insight-label">vs last month</span>
          </div>
        )}
        <div className="insight-card">
          <span className="insight-value">{yearBills.length}</span>
          <span className="insight-label">total bills</span>
        </div>
        <div className="insight-card">
          <span className="insight-value">{categoryTotals.length}</span>
          <span className="insight-label">categories</span>
        </div>
      </div>

      {/* Upcoming Bills This Week */}
      {upcomingBills.length > 0 && (
        <div className="chart-card upcoming-card">
          <h3>📌 Due This Week</h3>
          <div className="upcoming-list">
            {upcomingBills.map(bill => (
              <div key={bill.id} className="upcoming-item">
                <span className="upcoming-desc">{bill.description}</span>
                <span className="upcoming-amount">${bill.amount?.toFixed(2)}</span>
                <span className="upcoming-date">{new Date(bill.due_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Bar Chart - Interactive */}
      <div className="chart-card">
        <h3>Monthly Spending</h3>
        <div className="bar-chart">
          {monthlyTotals.map((total, i) => (
            <div
              key={i}
              className={`bar-col ${hoveredBar === i ? 'hovered' : ''} ${i === currentMonth && selectedYear === currentYear ? 'current' : ''}`}
              onMouseEnter={() => setHoveredBar(i)}
              onMouseLeave={() => setHoveredBar(null)}
            >
              {hoveredBar === i && total > 0 && (
                <div className="bar-tooltip">
                  <strong>${total.toFixed(2)}</strong>
                  <small>{monthlyCounts[i]} bill(s)</small>
                </div>
              )}
              <div className="bar-value">{total > 0 ? `$${total.toFixed(0)}` : ''}</div>
              <div className="bar-wrapper">
                <div
                  className="bar animated"
                  style={{
                    height: `${(total / maxMonthly) * 100}%`,
                    background: i === currentMonth && selectedYear === currentYear
                      ? 'linear-gradient(180deg, #1a73e8, #4285f4)'
                      : total > 0
                        ? 'linear-gradient(180deg, #34a853, #4caf50)'
                        : '#e0e0e0',
                  }}
                />
              </div>
              <div className="bar-label">{MONTHS[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Running Total Line Chart - Interactive */}
      <div className="chart-card">
        <h3>Cumulative Spending</h3>
        <div className="line-chart">
          <svg viewBox="0 0 380 200" preserveAspectRatio="xMidYMid meet" className="line-svg">
            {/* Grid lines with labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
              <g key={ratio}>
                <line
                  x1="40" y1={175 - ratio * 150}
                  x2="370" y2={175 - ratio * 150}
                  stroke="#f0f0f0"
                  strokeWidth="0.5"
                />
                <text x="36" y={179 - ratio * 150} textAnchor="end" fontSize="8" fill="#999">
                  ${(maxRunning * ratio / 1000).toFixed(1)}k
                </text>
              </g>
            ))}
            {/* Gradient fill under line */}
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#1a73e8" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon
              fill="url(#lineGradient)"
              points={`45,175 ${runningTotals.map((t, i) =>
                `${(i / 11) * 320 + 45},${175 - (t / maxRunning) * 150}`
              ).join(' ')} 365,175`}
            />
            {/* Line */}
            <polyline
              fill="none"
              stroke="#1a73e8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={runningTotals.map((t, i) =>
                `${(i / 11) * 320 + 45},${175 - (t / maxRunning) * 150}`
              ).join(' ')}
            />
            {/* Interactive dots */}
            {runningTotals.map((t, i) => (
              <g key={i} onMouseEnter={() => setHoveredDot(i)} onMouseLeave={() => setHoveredDot(null)}>
                <circle
                  cx={(i / 11) * 320 + 45}
                  cy={175 - (t / maxRunning) * 150}
                  r={hoveredDot === i ? 5 : 3}
                  fill={hoveredDot === i ? '#1557b0' : '#1a73e8'}
                  stroke="white"
                  strokeWidth="1.5"
                  style={{ transition: 'r 0.2s, fill 0.2s', cursor: 'pointer' }}
                />
                {hoveredDot === i && (
                  <text
                    x={(i / 11) * 320 + 45}
                    y={175 - (t / maxRunning) * 150 - 10}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#1a73e8"
                  >
                    ${t.toFixed(0)}
                  </text>
                )}
              </g>
            ))}
            {/* Month labels on X axis */}
            {MONTHS.map((m, i) => (
              <text
                key={m}
                x={(i / 11) * 320 + 45}
                y={192}
                textAnchor="middle"
                fontSize="7.5"
                fill="#999"
              >
                {m}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Year-over-Year Comparison */}
      {yoyData && (
        <div className="chart-card">
          <h3>
            Year-over-Year: {selectedYear} vs {yoyData.prevYear}
            {yoyData.changePercent && (
              <span className={`yoy-badge ${parseFloat(yoyData.changePercent) > 0 ? 'up' : 'down'}`}>
                {parseFloat(yoyData.changePercent) > 0 ? '▲' : '▼'} {Math.abs(yoyData.changePercent)}%
              </span>
            )}
          </h3>
          <div className="yoy-summary">
            <div className="yoy-stat">
              <span className="yoy-year">{selectedYear}</span>
              <span className="yoy-amount">${yearTotal.toFixed(2)}</span>
            </div>
            <div className="yoy-stat">
              <span className="yoy-year">{yoyData.prevYear}</span>
              <span className="yoy-amount">${yoyData.prevTotal.toFixed(2)}</span>
            </div>
            <div className="yoy-stat">
              <span className="yoy-year">Difference</span>
              <span className={`yoy-amount ${yearTotal - yoyData.prevTotal > 0 ? 'text-red' : 'text-green'}`}>
                {yearTotal - yoyData.prevTotal > 0 ? '+' : ''}${(yearTotal - yoyData.prevTotal).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="yoy-chart">
            {MONTHS.map((month, i) => {
              const curr = monthlyTotals[i];
              const prev = yoyData.prevMonthly[i];
              const maxVal = Math.max(...monthlyTotals, ...yoyData.prevMonthly, 1);
              return (
                <div key={i} className="yoy-col">
                  <div className="yoy-bars">
                    <div
                      className="yoy-bar current"
                      style={{ height: `${(curr / maxVal) * 100}%` }}
                      title={`${selectedYear}: $${curr.toFixed(2)}`}
                    />
                    <div
                      className="yoy-bar previous"
                      style={{ height: `${(prev / maxVal) * 100}%` }}
                      title={`${yoyData.prevYear}: $${prev.toFixed(2)}`}
                    />
                  </div>
                  <span className="yoy-label">{month}</span>
                </div>
              );
            })}
          </div>
          <div className="yoy-legend">
            <span className="yoy-legend-item"><span className="yoy-dot current" /> {selectedYear}</span>
            <span className="yoy-legend-item"><span className="yoy-dot previous" /> {yoyData.prevYear}</span>
          </div>
        </div>
      )}

      {/* Category Donut + List */}
      <div className="chart-card">
        <h3>Spending by Category</h3>
        <div className="category-chart-container">
          {/* Donut Chart */}
          <div className="donut-container">
            <svg viewBox="0 0 200 200" className="donut-svg">
              {donutSegments.map((seg, i) => (
                <path
                  key={seg.id}
                  d={getDonutPath(seg.startAngle, seg.angle - 0.5)}
                  fill={seg.color}
                  opacity={hoveredCategory === null || hoveredCategory === seg.id ? 1 : 0.3}
                  onMouseEnter={() => setHoveredCategory(seg.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  style={{ transition: 'opacity 0.2s, transform 0.2s', cursor: 'pointer' }}
                />
              ))}
              {/* Center text */}
              <circle cx="100" cy="100" r="50" fill="white" />
              <text x="100" y="95" textAnchor="middle" fontSize="11" fill="#666">Total</text>
              <text x="100" y="115" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">
                ${yearTotal.toFixed(0)}
              </text>
            </svg>
          </div>

          {/* Category Legend + Bars */}
          <div className="category-list">
            {categoryTotals.map(cat => {
              const completedMonths = selectedYear < currentYear ? 12 : Math.max(currentMonth, 1);
              const monthlyAvg = cat.total / completedMonths;
              return (
              <div
                key={cat.id}
                className={`category-row ${hoveredCategory === cat.id ? 'highlighted' : ''}`}
                onMouseEnter={() => setHoveredCategory(cat.id)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <div className="category-info">
                  <span className="category-dot" style={{ backgroundColor: cat.color }} />
                  <span className="category-icon">{cat.icon}</span>
                  <span className="category-name">{cat.label}</span>
                </div>
                <div className="category-bar-wrapper">
                  <div
                    className="category-bar animated"
                    style={{
                      width: `${(cat.total / categoryTotals[0].total) * 100}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
                <div className="category-values">
                  <span className="category-total">${cat.total.toFixed(2)}</span>
                  <span className="category-avg">~${monthlyAvg.toFixed(0)}/mo</span>
                  <span className="category-percent">{((cat.total / yearTotal) * 100).toFixed(0)}%</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="chart-card">
        <h3>Monthly Breakdown</h3>
        <div className="monthly-table-wrapper">
          <table className="monthly-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Bills</th>
                <th>Spent</th>
                <th>Running Total</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month, i) => (
                <tr
                  key={month}
                  className={`${monthlyTotals[i] === 0 ? 'row-empty' : ''} ${i === currentMonth && selectedYear === currentYear ? 'row-current' : ''}`}
                >
                  <td>{FULL_MONTHS[i]}</td>
                  <td>{monthlyCounts[i]}</td>
                  <td>${monthlyTotals[i].toFixed(2)}</td>
                  <td>${runningTotals[i].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>{yearBills.length}</strong></td>
                <td><strong>${yearTotal.toFixed(2)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
