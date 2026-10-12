const { google } = require('googleapis');
const { getOAuth2Client } = require('./gmail');

/**
 * Create a Google Calendar event for a bill due date.
 * Creates an all-day event with a reminder 2 days before.
 */
async function createBillReminder(bill) {
  const oauth2Client = await getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event = {
    summary: `💰 Bill Due: ${bill.description}`,
    description: `Amount: AUD ${bill.amount.toFixed(2)}\nBill: ${bill.description}`,
    start: {
      date: bill.due_date, // All-day event
      timeZone: process.env.TIMEZONE || 'Australia/Sydney',
    },
    end: {
      date: bill.due_date,
      timeZone: process.env.TIMEZONE || 'Australia/Sydney',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 2880 }, // 2 days before
        { method: 'popup', minutes: 1440 }, // 1 day before
        { method: 'popup', minutes: 60 },   // 1 hour before (on the day)
      ],
    },
    colorId: '11', // Red/tomato color for bills
  };

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    console.log(`Calendar event created: ${response.data.id} for "${bill.description}"`);
    return response.data.id;
  } catch (error) {
    console.error('Error creating calendar event:', error.message);
    throw error;
  }
}

/**
 * Delete a calendar event by its ID.
 */
async function deleteCalendarEvent(eventId) {
  if (!eventId) return;

  const oauth2Client = await getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
    console.log(`Calendar event deleted: ${eventId}`);
  } catch (error) {
    // Event may already be deleted, don't throw
    console.warn('Could not delete calendar event:', error.message);
  }
}

/**
 * Update a calendar event when bill details change.
 */
async function updateCalendarEvent(eventId, bill) {
  if (!eventId) return null;

  const oauth2Client = await getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event = {
    summary: `💰 Bill Due: ${bill.description}`,
    description: `Amount: AUD ${bill.amount.toFixed(2)}\nBill: ${bill.description}`,
    start: {
      date: bill.due_date,
      timeZone: process.env.TIMEZONE || 'Australia/Sydney',
    },
    end: {
      date: bill.due_date,
      timeZone: process.env.TIMEZONE || 'Australia/Sydney',
    },
  };

  try {
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      resource: event,
    });
    return response.data.id;
  } catch (error) {
    console.error('Error updating calendar event:', error.message);
    throw error;
  }
}

module.exports = {
  createBillReminder,
  deleteCalendarEvent,
  updateCalendarEvent,
};
