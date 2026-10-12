const admin = require('firebase-admin');

/**
 * Get all registered push tokens from Firestore.
 */
async function getAllPushTokens() {
  const db = admin.firestore();
  const snapshot = await db.collection('push_tokens').get();
  return snapshot.docs.map(doc => doc.data().token).filter(Boolean);
}

/**
 * Send a push notification to all registered devices.
 */
async function sendPushNotification({ title, body, data = {} }) {
  const tokens = await getAllPushTokens();
  if (tokens.length === 0) {
    console.log('[Push] No push tokens registered');
    return;
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      ...data,
      click_action: 'https://bill-reminder-73a35.web.app',
    },
  };

  // Send to each token
  const results = await Promise.allSettled(
    tokens.map(token =>
      admin.messaging().send({ ...message, token })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`[Push] Sent ${sent} notifications, ${failed} failed`);

  // Clean up invalid tokens
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      const error = results[i].reason;
      if (error?.code === 'messaging/registration-token-not-registered' ||
          error?.code === 'messaging/invalid-registration-token') {
        // Remove invalid token from Firestore
        const db = admin.firestore();
        const snapshot = await db.collection('push_tokens')
          .where('token', '==', tokens[i])
          .get();
        snapshot.docs.forEach(doc => doc.ref.delete());
        console.log(`[Push] Removed invalid token`);
      }
    }
  }

  return { sent, failed };
}

/**
 * Send push notification for a new bill.
 */
async function pushNewBill(bill) {
  const amount = typeof bill.amount === 'number' ? bill.amount.toFixed(2) : bill.amount;
  await sendPushNotification({
    title: '🔔 New Bill Added',
    body: `${bill.description} - AUD ${amount} due ${bill.due_date}`,
    data: { type: 'new_bill', billId: bill.id || '' },
  });
}

/**
 * Send push notification for a bill due today.
 */
async function pushBillDueToday(bill) {
  const amount = typeof bill.amount === 'number' ? bill.amount.toFixed(2) : bill.amount;
  await sendPushNotification({
    title: '⚠️ Bill Due Today!',
    body: `${bill.description} - AUD ${amount}`,
    data: { type: 'due_today', billId: bill.id || '' },
  });
}

module.exports = {
  sendPushNotification,
  pushNewBill,
  pushBillDueToday,
  getAllPushTokens,
};
