require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./db/database');
const billsRouter = require('./routes/bills');
const scanRouter = require('./routes/scan');
const authRouter = require('./routes/auth');
const cronRouter = require('./routes/cron');
const { startScheduler } = require('./services/scheduler');
const { sendTestMessage } = require('./services/telegram');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://bill-reminder-73a35.web.app',
    'https://bill-reminder-73a35.firebaseapp.com',
    'http://localhost:5173',
  ],
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api/bills', billsRouter);
app.use('/api/scan', scanRouter);
app.use('/api/cron', cronRouter);
app.use('/auth', authRouter);

// Notify new bill (called by frontend after adding directly to Firestore)
app.post('/api/bills/notify-new', async (req, res) => {
  try {
    const { sendBillAlert } = require('./services/telegram');
    const { createBillReminder } = require('./services/calendar');
    const { pushNewBill } = require('./services/push');
    const db = require('./db/database');
    const bill = req.body;

    if (bill.id && bill.amount && bill.due_date) {
      try {
        await sendBillAlert(bill);
        await db.markTelegramSent(bill.id);
      } catch (e) { console.warn('Telegram notify-new error:', e.message); }

      try {
        const eventId = await createBillReminder(bill);
        await db.setCalendarEventId(bill.id, eventId);
      } catch (e) { console.warn('Calendar notify-new error:', e.message); }

      // Send push notification
      try {
        await pushNewBill(bill);
      } catch (e) { console.warn('Push notify-new error:', e.message); }
    }

    res.json({ message: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug: list all bills in Firestore (temporary)
app.get('/api/debug/bills', async (req, res) => {
  try {
    const db = require('./db/database');
    const bills = await db.getAllBills();
    res.json({ count: bills.length, bills: bills.map(b => ({ id: b.id, description: b.description, due_date: b.due_date, amount: b.amount, email_id: b.email_id ? b.email_id.substring(0, 10) + '...' : null })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Telegram connection
app.post('/api/test-telegram', async (req, res) => {
  try {
    await sendTestMessage();
    res.json({ message: 'Test message sent to Telegram!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function start() {
  await initDb();
  console.log('Database initialized');

  app.listen(PORT, () => {
    console.log(`Bill Reminder API running on http://localhost:${PORT}`);
    console.log('');

    // Start scheduler only in local dev (Cloud Run uses Cloud Scheduler instead)
    if (process.env.NODE_ENV !== 'production') {
      startScheduler();
    }
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
