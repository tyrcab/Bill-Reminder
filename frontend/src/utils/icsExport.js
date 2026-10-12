/**
 * Generate an ICS (iCalendar) file from bills.
 * Can be imported into FamilyWall, Google Calendar, Outlook, etc.
 */
export function generateICS(bills) {
  const pendingBills = bills.filter(b => b.status === 'pending' && b.due_date);

  if (pendingBills.length === 0) return null;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bill Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Bill Reminders',
    'X-WR-TIMEZONE:Australia/Sydney',
  ];

  for (const bill of pendingBills) {
    const uid = `bill-${bill.id}@bill-reminder`;
    const due = bill.due_date.replace(/-/g, ''); // YYYYMMDD
    const amount = typeof bill.amount === 'number' ? bill.amount.toFixed(2) : bill.amount;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // Summary line
    const summary = escapeICS(`💰 ${bill.description} - AUD ${amount}`);
    const description = escapeICS(`Amount: AUD ${amount}\\nBill: ${bill.description}\\nDue: ${formatDate(bill.due_date)}`);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${due}`);
    lines.push(`DTEND;VALUE=DATE:${due}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push('STATUS:CONFIRMED');

    // Reminder 7 days before
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Bill due in 7 days: ${bill.description}`);
    lines.push('TRIGGER:-P7D');
    lines.push('END:VALARM');

    // Reminder 1 day before
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Bill due tomorrow: ${bill.description}`);
    lines.push('TRIGGER:-P1D');
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Download ICS file to the device.
 */
export function downloadICS(bills) {
  const ics = generateICS(bills);
  if (!ics) return false;

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bills_${new Date().toISOString().split('T')[0]}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

function escapeICS(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}
