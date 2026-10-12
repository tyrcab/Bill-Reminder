const TELEGRAM_API = 'https://api.telegram.org';

/**
 * Send a bill alert to Telegram using the bot API.
 * Matches the format from the user's screenshot:
 * 🔔 BILL ALERT
 * 💰 Amount: AUD 287.19
 * 📅 Due: Thu Jul 23 2026
 * 📋 Bill: Gas Bill 6 May 2026 - 1 July 2026
 */
async function sendBillAlert(bill) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in environment');
  }

  const message = formatBillMessage(bill);

  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  console.log(`Telegram alert sent for "${bill.description}"`);
  return data;
}

/**
 * Format a bill into the Telegram message format.
 */
function formatBillMessage(bill) {
  const dueDate = formatDueDate(bill.due_date);
  const amount = typeof bill.amount === 'number' ? bill.amount.toFixed(2) : bill.amount;

  return [
    '🔔 <b>BILL ALERT</b>',
    '',
    `💰 Amount: AUD ${amount}`,
    `📅 Due: ${dueDate}`,
    `📋 Bill: ${bill.description}`,
  ].join('\n');
}

/**
 * Format date as "Thu Jul 23 2026" to match the screenshot format.
 */
function formatDueDate(dateStr) {
  if (!dateStr) return 'Unknown';

  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayNum = date.getDate();
  const year = date.getFullYear();

  return `${dayName} ${monthName} ${dayNum} ${year}`;
}

/**
 * Send a test message to verify bot configuration.
 */
async function sendTestMessage() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set');
  }

  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '✅ Bill Reminder Bot is connected and working!',
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return data;
}

/**
 * Send a daily summary of upcoming bills.
 */
async function sendDailySummary(bills) {
  if (!bills || bills.length === 0) return;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set');
  }

  let message = '📊 <b>DAILY BILL SUMMARY</b>\n\n';
  let totalAmount = 0;

  for (const bill of bills) {
    const dueDate = formatDueDate(bill.due_date);
    const amount = typeof bill.amount === 'number' ? bill.amount.toFixed(2) : bill.amount;
    message += `• ${bill.description}\n  💰 AUD ${amount} | 📅 ${dueDate}\n\n`;
    totalAmount += bill.amount || 0;
  }

  message += `─────────────────\n`;
  message += `💰 <b>Total: AUD ${totalAmount.toFixed(2)}</b>\n`;
  message += `📋 <b>${bills.length} bill(s) upcoming</b>`;

  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return data;
}

/**
 * Send a reminder for a bill due tomorrow.
 */
async function sendDueReminder(bill) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set');
  }

  const dueDate = formatDueDate(bill.due_date);
  const amount = typeof bill.amount === 'number' ? bill.amount.toFixed(2) : bill.amount;

  const message = [
    '⏰ <b>BILL DUE TOMORROW</b>',
    '',
    `💰 Amount: AUD ${amount}`,
    `📅 Due: ${dueDate}`,
    `📋 Bill: ${bill.description}`,
    '',
    '💡 Don\'t forget to pay this bill!',
  ].join('\n');

  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  console.log(`Due reminder sent for "${bill.description}"`);
  return data;
}

module.exports = {
  sendBillAlert,
  sendDueReminder,
  sendTestMessage,
  sendDailySummary,
  formatBillMessage,
  formatDueDate,
};
