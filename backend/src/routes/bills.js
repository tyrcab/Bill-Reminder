const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { createBillReminder, deleteCalendarEvent } = require('../services/calendar');
const { sendBillAlert } = require('../services/telegram');

/**
 * Calculate the next due date based on recurrence type.
 */
function calculateNextDueDate(currentDueDate, recurrence) {
  const date = new Date(currentDueDate + 'T00:00:00');

  switch (recurrence) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'fortnightly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return currentDueDate;
  }

  return date.toISOString().split('T')[0];
}

// GET /api/bills - Get all bills
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let bills;
    if (status === 'pending') {
      bills = await db.getPendingBills();
    } else {
      bills = await db.getAllBills();
    }
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bills/upcoming - Get upcoming bills (next 7 days)
router.get('/upcoming', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const bills = await db.getUpcomingBills(days);
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bills/:id - Get a single bill
router.get('/:id', async (req, res) => {
  try {
    const bill = await db.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bills - Create a new bill (manual entry)
router.post('/', async (req, res) => {
  try {
    const { amount, due_date, description } = req.body;

    if (!amount || !due_date || !description) {
      return res.status(400).json({ error: 'amount, due_date, and description are required' });
    }

    const bill = await db.createBill({
      amount: parseFloat(amount),
      due_date,
      description,
      source: 'manual',
    });

    // Create calendar reminder
    try {
      const eventId = await createBillReminder(bill);
      await db.setCalendarEventId(bill.id, eventId);
      bill.calendar_event_id = eventId;
    } catch (calError) {
      console.warn('Could not create calendar event:', calError.message);
    }

    // Send Telegram notification
    try {
      await sendBillAlert(bill);
      await db.markTelegramSent(bill.id);
      bill.telegram_sent = true;
    } catch (tgError) {
      console.warn('Could not send Telegram alert:', tgError.message);
    }

    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/bills/:id - Update a bill
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.getBillById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const { amount, due_date, description, status, category } = req.body;
    const bill = await db.updateBill(req.params.id, { amount, due_date, description, status, category });

    // If marked as PAID: delete calendar event
    if (status === 'paid') {
      if (existing.calendar_event_id) {
        try {
          await deleteCalendarEvent(existing.calendar_event_id);
          await db.setCalendarEventId(req.params.id, null);
        } catch (calError) {
          console.warn('Could not delete calendar event:', calError.message);
        }
      }

      // If has recurrence, create the next bill
      if (existing.recurrence && existing.recurrence !== 'none') {
        try {
          const nextDueDate = calculateNextDueDate(existing.due_date, existing.recurrence);
          const nextBill = await db.createBill({
            amount: existing.amount,
            due_date: nextDueDate,
            description: existing.description,
            source: 'manual',
            category: existing.category || null,
            recurrence: existing.recurrence,
          });

          // Send Telegram notification for new recurring bill
          // (notification will be sent 7 days before due via scheduler, not now)

          // Create calendar event for next bill
          try {
            const eventId = await createBillReminder(nextBill);
            await db.setCalendarEventId(nextBill.id, eventId);
          } catch (e) { /* non-critical */ }
        } catch (recurError) {
          console.warn('Could not create recurring bill:', recurError.message);
        }
      }
    }

    // If marked as UNPAID (undo paid): re-create calendar event only (no notification)
    if (status === 'pending' && existing.status === 'paid') {
      // Create new calendar reminder
      try {
        const eventId = await createBillReminder(bill);
        await db.setCalendarEventId(req.params.id, eventId);
      } catch (calError) {
        console.warn('Could not create calendar event:', calError.message);
      }
    }

    // Update calendar event if it exists and relevant fields changed (not status changes)
    if (!status && existing.calendar_event_id && (due_date || description || amount)) {
      try {
        const { updateCalendarEvent } = require('../services/calendar');
        await updateCalendarEvent(existing.calendar_event_id, bill);
      } catch (calError) {
        console.warn('Could not update calendar event:', calError.message);
      }
    }

    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/bills/:id - Delete a bill
router.delete('/:id', async (req, res) => {
  try {
    const bill = await db.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Delete associated calendar event
    if (bill.calendar_event_id) {
      try {
        await deleteCalendarEvent(bill.calendar_event_id);
      } catch (calError) {
        console.warn('Could not delete calendar event:', calError.message);
      }
    }

    await db.deleteBill(req.params.id);
    res.json({ message: 'Bill deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bills/:id/notify - Resend Telegram notification for a bill
router.post('/:id/notify', async (req, res) => {
  try {
    const bill = await db.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    await sendBillAlert(bill);
    await db.markTelegramSent(bill.id);
    res.json({ message: 'Notification sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
