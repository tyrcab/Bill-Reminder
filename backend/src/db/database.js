const admin = require('firebase-admin');
const path = require('path');

let db = null;

/**
 * Initialize Firebase Admin and Firestore.
 */
function initDb() {
  if (db) return Promise.resolve(db);

  if (!admin.apps.length) {
    // On Cloud Run, use Application Default Credentials (no key needed)
    // Locally, use the service account file
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const absolutePath = path.resolve(__dirname, '..', '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      const serviceAccount = require(absolutePath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Cloud Run has Application Default Credentials automatically
      admin.initializeApp();
    }
  }

  db = admin.firestore();
  console.log('Firestore initialized');
  return Promise.resolve(db);
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

const COLLECTION = 'bills';

/**
 * Convert Firestore doc to bill object with id.
 */
function docToBill(doc) {
  return { id: doc.id, ...doc.data() };
}

async function getAllBills() {
  const snapshot = await db.collection(COLLECTION).orderBy('due_date', 'asc').get();
  return snapshot.docs.map(docToBill);
}

async function getPendingBills() {
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .orderBy('due_date', 'asc')
    .get();
  return snapshot.docs.map(docToBill);
}

async function getUpcomingBills(daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .where('due_date', '<=', futureDateStr)
    .orderBy('due_date', 'asc')
    .get();
  return snapshot.docs.map(docToBill);
}

async function getBillById(id) {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return docToBill(doc);
}

async function createBill({ amount, due_date, description, source = 'manual', email_id = null, recurrence = 'none' }) {
  const billData = {
    amount,
    due_date,
    description,
    source,
    status: 'pending',
    recurrence,
    email_id: email_id || null,
    calendar_event_id: null,
    telegram_sent: false,
    reminder_sent: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const docRef = await db.collection(COLLECTION).add(billData);
  return { id: docRef.id, ...billData };
}

async function updateBill(id, { amount, due_date, description, status, recurrence, category }) {
  const updates = {};

  if (amount !== undefined) updates.amount = amount;
  if (due_date !== undefined) updates.due_date = due_date;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (recurrence !== undefined) updates.recurrence = recurrence;
  if (category !== undefined) updates.category = category;

  if (Object.keys(updates).length === 0) return getBillById(id);

  updates.updated_at = new Date().toISOString();

  await db.collection(COLLECTION).doc(id).update(updates);
  return getBillById(id);
}

async function deleteBill(id) {
  await db.collection(COLLECTION).doc(id).delete();
}

async function markTelegramSent(id) {
  await db.collection(COLLECTION).doc(id).update({
    telegram_sent: true,
    updated_at: new Date().toISOString(),
  });
}

async function markReminderSent(id) {
  await db.collection(COLLECTION).doc(id).update({
    reminder_sent: true,
    updated_at: new Date().toISOString(),
  });
}

async function getBillsDueTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .where('due_date', '==', tomorrowStr)
    .get();
  return snapshot.docs.map(docToBill);
}

async function getBillsDueInDays(days) {
  const target = new Date();
  target.setDate(target.getDate() + days);
  const targetStr = target.toISOString().split('T')[0];

  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .where('due_date', '==', targetStr)
    .get();
  return snapshot.docs.map(docToBill);
}

async function getOverdueBills() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .where('due_date', '<=', yesterdayStr)
    .get();
  return snapshot.docs.map(docToBill);
}

async function setCalendarEventId(id, eventId) {
  await db.collection(COLLECTION).doc(id).update({
    calendar_event_id: eventId,
    updated_at: new Date().toISOString(),
  });
}

async function billExistsByEmailId(emailId) {
  const snapshot = await db.collection(COLLECTION)
    .where('email_id', '==', emailId)
    .limit(1)
    .get();
  return !snapshot.empty;
}

async function getBillByEmailId(emailId) {
  const snapshot = await db.collection(COLLECTION)
    .where('email_id', '==', emailId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return docToBill(snapshot.docs[0]);
}

module.exports = {
  initDb,
  getDb,
  getAllBills,
  getPendingBills,
  getUpcomingBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  markTelegramSent,
  markReminderSent,
  setCalendarEventId,
  billExistsByEmailId,
  getBillByEmailId,
  getBillsDueTomorrow,
  getBillsDueInDays,
  getOverdueBills,
};
