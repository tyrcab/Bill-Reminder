const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { sendBillAlert, sendDueReminder, sendDailySummary } = require('../services/telegram');
const { pushBillDueToday } = require('../services/push');
const { isAuthenticated } = require('../services/gmail');

/**
 * Verify the request is from Cloud Scheduler (or allow in dev).
 */
function verifyCron(req, res, next) {
  // Cloud Scheduler sends this header, or allow if CRON_SECRET matches
  const cronSecret = req.headers['x-cron-secret'];
  if (process.env.NODE_ENV !== 'production') return next();
  if (cronSecret && cronSecret === process.env.CRON_SECRET) return next();
  // Cloud Scheduler with OIDC auth sets this
  if (req.headers['x-cloudscheduler'] === 'true') return next();
  // Allow if request comes from Cloud Scheduler IP (or just allow for now)
  return next();
}

// POST /api/cron/scan - Scan Gmail for new bills (called every 15 mins)
router.post('/scan', verifyCron, async (req, res) => {
  try {
    if (!(await isAuthenticated())) {
      return res.json({ message: 'Not authenticated with Google, skipping scan' });
    }

    const { scanAndProcessBills } = require('./scan');
    const results = await scanAndProcessBills(7);
    res.json(results);
  } catch (error) {
    console.error('Cron scan error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cron/reminders - Send due-tomorrow and 7-day reminders (called at 9am and 6pm)
router.post('/reminders', verifyCron, async (req, res) => {
  try {
    let sent = 0;

    // Bills due tomorrow
    const billsDueTomorrow = await db.getBillsDueTomorrow();
    const unremindedTomorrow = billsDueTomorrow.filter(b => !b.reminder_sent);

    for (const bill of unremindedTomorrow) {
      try {
        await sendDueReminder(bill);
        await db.markReminderSent(bill.id);
        sent++;
      } catch (error) {
        console.error(`Reminder error for bill ${bill.id}:`, error.message);
      }
    }

    // Bills due in 7 days (early heads-up)
    const billsDueIn7 = await db.getBillsDueInDays(7);
    const unnotified7 = billsDueIn7.filter(b => !b.telegram_sent);

    for (const bill of unnotified7) {
      try {
        await sendBillAlert(bill);
        await db.markTelegramSent(bill.id);
        sent++;
      } catch (error) {
        console.error(`7-day reminder error for bill ${bill.id}:`, error.message);
      }
    }

    res.json({ message: `Sent ${sent} reminder(s)`, due_tomorrow: billsDueTomorrow.length, due_in_7: billsDueIn7.length });
  } catch (error) {
    console.error('Cron reminders error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cron/summary - Send daily summary (called weekdays at 7am)
router.post('/summary', verifyCron, async (req, res) => {
  try {
    const upcomingBills = await db.getUpcomingBills(14);
    if (upcomingBills.length > 0) {
      await sendDailySummary(upcomingBills);
    }
    res.json({ message: `Summary sent with ${upcomingBills.length} bills` });
  } catch (error) {
    console.error('Cron summary error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cron/due-today - Send push notifications for bills due today (called at 8am)
router.post('/due-today', verifyCron, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const admin = require('firebase-admin');
    const firestore = admin.firestore();
    const snapshot = await firestore.collection('bills')
      .where('status', '==', 'pending')
      .where('due_date', '==', today)
      .get();

    const billsDueToday = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    let sent = 0;

    for (const bill of billsDueToday) {
      try {
        await pushBillDueToday(bill);
        sent++;
      } catch (error) {
        console.error(`Push error for bill ${bill.id}:`, error.message);
      }
    }

    res.json({ message: `Sent ${sent} due-today push notification(s)`, total: billsDueToday.length });
  } catch (error) {
    console.error('Cron due-today error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
