const express = require('express');
const router = express.Router();
const { fetchBillEmails, parseBillEmail, isAuthenticated, labelEmailAsProcessed, getEmailBody, getEmailHtml } = require('../services/gmail');
const { createBillReminder } = require('../services/calendar');
const { sendBillAlert } = require('../services/telegram');
const db = require('../db/database');
const admin = require('firebase-admin');

/**
 * Get list of ignored patterns from Firestore.
 */
async function getIgnoredPatterns() {
  try {
    const firestore = admin.firestore();
    const snapshot = await firestore.collection('ignored_senders').get();
    return snapshot.docs.map(doc => doc.data().pattern || '');
  } catch {
    return [];
  }
}

/**
 * Check if a bill description matches any ignored pattern.
 */
function isIgnored(description, patterns) {
  const desc = description.toLowerCase().replace(/\d+/g, '').trim();
  return patterns.some(pattern => {
    if (!pattern) return false;
    // Check if the patterns share significant words
    const patternWords = pattern.split(/\s+/).filter(w => w.length > 2);
    const descWords = desc.split(/\s+/).filter(w => w.length > 2);
    const matchCount = patternWords.filter(pw => descWords.some(dw => dw.includes(pw) || pw.includes(dw))).length;
    return matchCount >= Math.min(2, patternWords.length);
  });
}

// POST /api/scan - Trigger a manual Gmail scan for bills
router.post('/', async (req, res) => {
  try {
    if (!(await isAuthenticated())) {
      return res.status(401).json({ error: 'Not authenticated with Google. Please connect your account first.' });
    }

    const daysBack = parseInt(req.body.days) || 30;
    const includeProcessed = req.body.include_processed || false;
    const results = await scanAndProcessBills(daysBack, includeProcessed);
    res.json(results);
  } catch (error) {
    console.error('Scan error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Scan Gmail for bills, parse them, save to DB, label in Gmail, create calendar events, and notify via Telegram.
 */
async function scanAndProcessBills(daysBack = 30, includeProcessed = false) {
  const emails = await fetchBillEmails(daysBack, includeProcessed);

  // Load ignore list
  const ignoredPatterns = await getIgnoredPatterns();

  const results = {
    scanned: emails.length,
    new_bills: 0,
    skipped: 0,
    errors: [],
  };

  for (const email of emails) {
    try {
      // Check if bill already exists in database
      const existingBill = await db.getBillByEmailId(email.id);
      const subj = email.payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';

      if (existingBill) {
        if (!includeProcessed) {
          results.skipped++;
          continue;
        }
        // Re-scanning: delete old entry to re-parse fresh
        await db.deleteBill(existingBill.id);
      }

      console.log(`[Scan] Processing: "${subj}" (email_id: ${email.id.substring(0, 12)}...)`);

      // Parse the email for bill details
      const parsed = await parseBillEmail(email);
      if (!parsed) {
        const subj2 = email.payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
        console.log(`[Scan] SKIPPED (parse failed): "${subj2}"`);
        results.skipped++;
        continue;
      }

      // Skip bills without a due date
      if (!parsed.due_date) {
        console.log(`[Scan] SKIPPED (no due date): "${parsed.description}" amount=$${parsed.amount}`);
        results.skipped++;
        continue;
      }

      // Skip if description matches an ignored pattern
      if (isIgnored(parsed.description, ignoredPatterns)) {
        console.log(`[Scan] SKIPPED (ignored pattern): "${parsed.description}"`);
        results.skipped++;
        continue;
      }

      console.log(`[Scan] New bill found: "${parsed.description}" $${parsed.amount} due ${parsed.due_date}`);

      // Create the bill in the database
      const bill = await db.createBill({
        amount: parsed.amount,
        due_date: parsed.due_date,
        description: parsed.description,
        source: 'gmail',
        email_id: parsed.email_id,
      });

      // Label the email as "Processed-Bill" in Gmail
      try {
        await labelEmailAsProcessed(email.id);
      } catch (labelError) {
        console.warn(`Label error for email ${email.id}:`, labelError.message);
      }

      // Create calendar reminder
      try {
        const eventId = await createBillReminder(bill);
        await db.setCalendarEventId(bill.id, eventId);
      } catch (calError) {
        console.warn(`Calendar error for bill ${bill.id}:`, calError.message);
      }

      // Send Telegram notification
      try {
        await sendBillAlert(bill);
        await db.markTelegramSent(bill.id);
      } catch (tgError) {
        console.warn(`Telegram error for bill ${bill.id}:`, tgError.message);
      }

      results.new_bills++;
    } catch (error) {
      results.errors.push({ email_id: email.id, error: error.message });
    }
  }

  console.log(`Scan complete: ${results.scanned} emails, ${results.new_bills} new bills, ${results.skipped} skipped`);
  return results;
}

module.exports = router;
module.exports.scanAndProcessBills = scanAndProcessBills;
