const cron = require('node-cron');
const db = require('../db/database');
const { sendBillAlert, sendDueReminder, sendDailySummary } = require('./telegram');
const { isAuthenticated } = require('./gmail');

let scanJob = null;
let dueReminderJob = null;
let summaryJob = null;

/**
 * Start all scheduled jobs.
 */
function startScheduler() {
  console.log('Starting scheduler...');

  // Scan Gmail for new bills every 15 minutes
  scanJob = cron.schedule('*/15 * * * *', async () => {
    console.log('[Scheduler] Running Gmail scan...');
    try {
      if (await isAuthenticated()) {
        const { scanAndProcessBills } = require('../routes/scan');
        await scanAndProcessBills(7); // Check last 7 days
      } else {
        console.log('[Scheduler] Skipping Gmail scan - not authenticated');
      }
    } catch (error) {
      console.error('[Scheduler] Gmail scan error:', error.message);
    }
  });

  // Check for bills due tomorrow and send Telegram reminder (runs at 9am and 6pm)
  dueReminderJob = cron.schedule('0 9,18 * * *', async () => {
    console.log('[Scheduler] Checking for bills due tomorrow...');
    try {
      const billsDueTomorrow = await db.getBillsDueTomorrow();
      const unreminded = billsDueTomorrow.filter(b => !b.reminder_sent);

      for (const bill of unreminded) {
        try {
          await sendDueReminder(bill);
          await db.markReminderSent(bill.id);
        } catch (error) {
          console.error(`[Scheduler] Failed to send due reminder for bill ${bill.id}:`, error.message);
        }
      }

      if (unreminded.length > 0) {
        console.log(`[Scheduler] Sent ${unreminded.length} due-tomorrow reminder(s)`);
      }
    } catch (error) {
      console.error('[Scheduler] Due reminder error:', error.message);
    }
  });

  // Send daily summary at 7am on weekdays
  summaryJob = cron.schedule('0 7 * * 1-5', async () => {
    console.log('[Scheduler] Sending daily summary...');
    try {
      const upcomingBills = await db.getUpcomingBills(14);
      if (upcomingBills.length > 0) {
        await sendDailySummary(upcomingBills);
        console.log(`[Scheduler] Daily summary sent with ${upcomingBills.length} bills`);
      }
    } catch (error) {
      console.error('[Scheduler] Summary error:', error.message);
    }
  });

  console.log('Scheduler started:');
  console.log('  - Gmail scan: every 15 minutes');
  console.log('  - Due-tomorrow reminders: 9am and 6pm daily');
  console.log('  - Daily summary: weekdays at 7am');
}

/**
 * Stop all scheduled jobs.
 */
function stopScheduler() {
  if (scanJob) scanJob.stop();
  if (dueReminderJob) dueReminderJob.stop();
  if (summaryJob) summaryJob.stop();
  console.log('Scheduler stopped');
}

module.exports = { startScheduler, stopScheduler };
