const { google } = require('googleapis');
const admin = require('firebase-admin');

const TOKEN_DOC = 'config/google_token';

/**
 * Get token from Firestore.
 */
async function getStoredToken() {
  try {
    const db = admin.firestore();
    const doc = await db.doc(TOKEN_DOC).get();
    if (doc.exists) return doc.data();
    return null;
  } catch {
    return null;
  }
}

/**
 * Save token to Firestore.
 */
async function saveToken(tokens) {
  try {
    const db = admin.firestore();
    const existing = await getStoredToken();
    const merged = { ...(existing || {}), ...tokens };
    await db.doc(TOKEN_DOC).set(merged);
    return merged;
  } catch (err) {
    console.error('Failed to save token to Firestore:', err.message);
  }
}

// Cache the token in memory for the lifetime of this instance
let cachedToken = null;

/**
 * Get OAuth2 client configured with credentials from environment variables.
 */
async function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
  );

  // Load token from cache or Firestore
  if (!cachedToken) {
    cachedToken = await getStoredToken();
  }
  if (cachedToken) {
    oauth2Client.setCredentials(cachedToken);
  }

  oauth2Client.on('tokens', async (tokens) => {
    cachedToken = { ...(cachedToken || {}), ...tokens };
    oauth2Client.setCredentials(cachedToken);
    await saveToken(tokens);
  });

  return oauth2Client;
}

function getAuthUrl() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
  );
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
}

async function handleAuthCallback(code) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
  );
  const { tokens } = await oauth2Client.getToken(code);
  cachedToken = tokens;
  await saveToken(tokens);
  return tokens;
}

async function isAuthenticated() {
  if (!cachedToken) {
    cachedToken = await getStoredToken();
  }
  return !!(cachedToken && (cachedToken.access_token || cachedToken.refresh_token));
}

/**
 * Fetch recent bill-related emails from Gmail.
 * Broad keyword search to catch bills from AU providers.
 */
async function fetchBillEmails(daysBack = 30, includeProcessed = false) {
  const oauth2Client = await getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const billKeywords = [
    'bill',
    'invoice',
    'payment due',
    'amount due',
    'total due',
    'statement',
    'payment reminder',
    'electricity',
    'gas bill',
    'water bill',
    'internet bill',
    'phone bill',
    'insurance',
    'rent',
    'superloop',
    'spintel',
    'afterpay',
    'optus',
    'telstra',
    'powershop',
    'south east water',
    'globird',
    'energy australia',
    'agl',
    'origin energy',
    'alinta',
    'simply energy',
    'red energy',
    'nbn',
  ];

  const dateFilter = `newer_than:${daysBack}d`;
  const query = `(${billKeywords.map(k => `"${k}"`).join(' OR ')}) ${dateFilter} -category:promotions`;

  console.log(`[Gmail] Query: ${query.substring(0, 150)}...`);
  console.log(`[Gmail] Days back: ${daysBack}`);

  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
    });

    // Also do a second targeted search for powershop bills specifically
    const powershopResponse = await gmail.users.messages.list({
      userId: 'me',
      q: `from:powershop newer_than:${daysBack}d`,
      maxResults: 10,
    });

    // Third targeted search for GloBird
    const globirdResponse = await gmail.users.messages.list({
      userId: 'me',
      q: `from:globird newer_than:${daysBack}d`,
      maxResults: 10,
    });

    console.log(`[Gmail] Main search found: ${response.data.messages?.length || 0} emails`);
    console.log(`[Gmail] Powershop search found: ${powershopResponse.data.messages?.length || 0} emails`);
    console.log(`[Gmail] GloBird search found: ${globirdResponse.data.messages?.length || 0} emails`);

    // Merge results (deduplicate by id)
    const allMessageIds = new Set();
    const allMessages = [];

    for (const msg of (response.data.messages || [])) {
      allMessageIds.add(msg.id);
      allMessages.push(msg);
    }
    for (const msg of (powershopResponse.data.messages || [])) {
      if (!allMessageIds.has(msg.id)) {
        allMessageIds.add(msg.id);
        allMessages.push(msg);
      }
    }
    for (const msg of (globirdResponse.data.messages || [])) {
      if (!allMessageIds.has(msg.id)) {
        allMessageIds.add(msg.id);
        allMessages.push(msg);
      }
    }

    if (allMessages.length === 0) {
      return [];
    }

    const emails = [];
    for (const msg of allMessages) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });
      emails.push(detail.data);
    }

    return emails;
  } catch (error) {
    console.error('Error fetching Gmail messages:', error.message);
    throw error;
  }
}

/**
 * Extract text from a PDF attachment buffer using pdf-parse.
 */
async function extractPdfText(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    console.warn('[PDF] Failed to parse PDF:', err.message);
    return '';
  }
}

/**
 * Download a PDF attachment from Gmail and extract its text.
 */
async function getPdfAttachmentText(message) {
  const oauth2Client = await getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Find PDF attachments in the message
  const pdfParts = [];

  function findPdfs(payload) {
    if (!payload) return;
    if (payload.mimeType === 'application/pdf' && payload.body) {
      pdfParts.push(payload);
    }
    if (payload.parts) {
      payload.parts.forEach(findPdfs);
    }
  }

  findPdfs(message.payload);

  if (pdfParts.length === 0) return '';

  // Download and parse the first PDF
  const part = pdfParts[0];
  let pdfBuffer;

  if (part.body.data) {
    // Inline data
    pdfBuffer = Buffer.from(part.body.data, 'base64');
  } else if (part.body.attachmentId) {
    // External attachment - need to download
    try {
      const attachment = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: message.id,
        id: part.body.attachmentId,
      });
      pdfBuffer = Buffer.from(attachment.data.data, 'base64');
    } catch (err) {
      console.warn('[PDF] Failed to download attachment:', err.message);
      return '';
    }
  }

  if (!pdfBuffer) return '';

  const text = await extractPdfText(pdfBuffer);
  console.log(`[PDF] Extracted ${text.length} chars from PDF attachment`);
  return text;
}

/**
 * Parse a Gmail message to extract bill details.
 * Now async to support PDF attachment parsing.
 */
async function parseBillEmail(message) {
  const headers = message.payload.headers;
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
  const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';

  // Skip notification/reminder emails — these are duplicates of actual bills
  if (/^(?:notification|reminder|re:|fwd?:)\s*(?:notification|reminder)/i.test(subject)) {
    return null;
  }
  // Skip Google Calendar notifications
  if (/^notification:/i.test(subject) && /@/.test(subject)) {
    return null;
  }
  // Skip auto-forwarded calendar reminders (contain @ and time)
  if (/notification:.*@.*\d{1,2}:\d{2}/i.test(subject)) {
    return null;
  }
  // Skip informational/promotional emails that aren't actual bills
  if (/price[s]?\s+(?:are\s+)?chang|sparking tension|too expensive|too much for|counting down|bubble wrap|WIN\s+\d|EOFY|secret PIN|order\s*#|installation date|been cancelled|been reactivated|will be suspended|roaming is now|failures for|forgotten to pay|important information about/i.test(subject)) {
    return null;
  }

  // Get both plain text and HTML body
  const body = getEmailBody(message.payload);
  const htmlBody = getEmailHtml(message.payload);

  // Combine all text for searching (strip HTML tags from HTML body)
  const plainFromHtml = htmlBody.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ');
  // Strip zero-width characters that break regex matching
  const allText = `${subject}\n${body}\n${plainFromHtml}`.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '');

  // Try to extract amount
  let amount = extractAmount(allText);

  // Try to extract due date
  let dueDate = extractDueDate(allText);

  // Build description
  const description = buildDescription(subject, from);

  // If body parsing failed, try PDF attachment
  if (!amount || !dueDate) {
    try {
      const pdfText = await getPdfAttachmentText(message);
      if (pdfText.length > 0) {
        console.log(`[PDF] Trying PDF text for "${subject}"`);
        const cleanPdfText = pdfText.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '');
        if (!amount) amount = extractAmount(cleanPdfText);
        if (!dueDate) dueDate = extractDueDate(cleanPdfText);
        console.log(`[PDF] Extracted from PDF: amount=${amount}, dueDate=${dueDate}`);
        if (!dueDate) {
          // Show what date-like text is in the PDF to help debug
          const dateHints = cleanPdfText.match(/\d{1,2}\s+\w+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/g);
          console.log(`[PDF] Date hints:`, dateHints ? dateHints.slice(0, 8) : 'NONE');
          const dueParts = cleanPdfText.match(/.{0,20}(?:due|pay\s*by|payment\s*date).{0,40}/gi);
          console.log(`[PDF] Due context:`, dueParts ? dueParts.slice(0, 5) : 'NONE');
          // Show first 300 chars of PDF
          console.log(`[PDF] Start of PDF:`, cleanPdfText.substring(0, 300));
        }
      }
    } catch (err) {
      console.warn('[PDF] Error reading attachment:', err.message);
    }
  }

  // Must have BOTH amount and due date to be a real bill
  if (!amount || !dueDate) {
    return null;
  }

  return {
    amount: amount || 0,
    due_date: dueDate || null,
    description: description,
    email_id: message.id,
  };
}

/**
 * Extract the text/plain body from a Gmail message payload.
 */
function getEmailBody(payload) {
  let body = '';

  if (payload.body && payload.body.data) {
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf8');
    if (payload.mimeType === 'text/plain') {
      body = decoded;
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.mimeType === 'multipart/alternative' && part.parts) {
        body += getEmailBody(part);
      } else if (part.parts) {
        body += getEmailBody(part);
      }
    }
  }

  return body;
}

/**
 * Extract the text/html body from a Gmail message payload.
 */
function getEmailHtml(payload) {
  let html = '';

  if (payload.body && payload.body.data && payload.mimeType === 'text/html') {
    html = Buffer.from(payload.body.data, 'base64').toString('utf8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        html += Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.parts) {
        html += getEmailHtml(part);
      }
    }
  }

  return html;
}

/**
 * Extract monetary amount from text.
 * Strategy: look for amounts near bill keywords first, then fall back to the largest amount found.
 */
function extractAmount(text) {
  // Priority patterns - strongly associated with the actual bill amount
  const priorityPatterns = [
    // "total due: $287.19" or "amount due: $86.56" or "total amount due $29.67"
    /(?:total|amount)\s*(?:due|owing|payable)[:\s]*\$\s*(\d{1,6}\.\d{2})/i,
    // "amount due $12.54"
    /amount\s*due[:\s]*\$\s*(\d{1,6}\.\d{2})/i,
    // "total due $3.52" or "Total due $139.85" (may have newlines between)
    /total\s*due[\s:]*\$\s*(\d{1,6}\.\d{2})/i,
    // "bill amount $78.56" (Optus format)
    /bill\s*amount[:\s]*\$\s*(\d{1,6}\.\d{2})/i,
    // "$78.56 Bill amount" (reversed)
    /\$\s*(\d{1,6}\.\d{2})\s*bill\s*amount/i,
    // "your bill total $287.19" or "bill total: $287.19"
    /(?:bill|your)\s*(?:bill\s*)?total[:\s]*\$\s*(\d{1,6}\.\d{2})/i,
    // "the amount is $86.56"
    /(?:the\s+)?amount\s+(?:is|of)[:\s]*\$\s*(\d{1,6}\.\d{2})/i,
    // "you owe $287.19" or "owing $287.19"
    /(?:you\s+owe|owing)[:\s]*\$\s*(\d{1,6}\.\d{2})/i,
    // "pay $287.19" or "payment of $287.19"
    /(?:pay|payment\s*(?:of)?)[:\s]*\$\s*(\d{1,6}\.\d{2})/i,
    // "current charges $139.85"
    /(?:current\s*charges|new\s*charges)[:\s]*\$\s*(\d{1,6}\.\d{2})/i,
    // "AUD 123.45" or "A$123.45" (must have cents)
    /(?:AUD|A)\$?\s*(\d{1,6}\.\d{2})/i,
    // "$287.19" near bill-related words (within 30 chars)
    /(?:bill|due|pay|total|amount|balance|owing|debit)[^\n$]{0,30}\$\s*(\d{1,6}\.\d{2})/i,
  ];

  for (const pattern of priorityPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val >= 1 && val < 100000) return val;
    }
  }

  // Fallback: find ALL dollar amounts (with cents) and pick the largest one
  const allAmounts = [];
  const globalPattern = /\$\s*(\d{1,6}\.\d{2})/g;
  let match;
  while ((match = globalPattern.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (val >= 1 && val < 100000) {
      allAmounts.push(val);
    }
  }

  if (allAmounts.length > 0) {
    return Math.max(...allAmounts);
  }

  return null;
}

/**
 * Extract due date from text. Handles many Australian date formats.
 */
function extractDueDate(text) {
  // Strip billing period patterns that contain dates but aren't due dates
  // e.g. "31 October 2025 - 4 January 2026", "October 2025 - January 2026"
  const cleanedText = text
    .replace(/\d{1,2}\s+\w+\s+\d{4}\s*[-–—to]+\s*\d{1,2}\s+\w+\s+\d{4}/gi, '')
    .replace(/\w+\s+\d{4}\s*[-–—to]+\s*\w+\s+\d{4}/gi, '')
    .replace(/(?:period|for the period)[^\n]{0,100}?\d{1,2}\s+\w+\s+\d{4}/gi, '');

  // First pass: look for explicitly labeled due dates (highest confidence)
  const explicitPatterns = [
    // "due 27 January 2026" (Powershop - just "due" then date, flexible spacing)
    /\bdue\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{4})/i,
    // "Date due: 13 March 2026" or "Date due 13 March 2026" (South East Water - reversed)
    /date\s*due[:\s]*(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{4})/i,
    // "Due date    Fri, 10 July 2026" (Afterpay format)
    /due\s*date[:\s]*(?:\w{3,9}day)?[,\s]*(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{4})/i,
    // "due date: 17 Jul 2026"
    /due\s*date[:\s]+(\d{1,2})(?:st|nd|rd|th)?[\s\/\-]+(\w{3,9}|\d{1,2})[\s\/\-]+(\d{2,4})/i,
    // "due date: July 10, 2026"
    /due\s*date[:\s]+(\w{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})/i,
    // "pay by: 17 Jul 2026" or "payment date: 17 Jul 2026"
    /(?:pay\s*by|payment\s*date)[:\s]+(?:\w+day[,\s]*)?(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{4})/i,
    // "due on 17 Jul 2026"
    /due\s*on[:\s]+(?:\w+day[,\s]*)?(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{4})/i,
    // "due: 17/07/2026"
    /due\s*date?[:\s]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    // "Date due: 13 March 2026" reversed with DD/MM/YYYY
    /date\s*due[:\s]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    // "Due date: 02 July" or "due date: 15 March" (NO YEAR - assume current year)
    /(?:due\s*date|date\s*due)[:\s]*(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})(?!\s+\d{4})/i,
    // "due 02 July" (no year)
    /\bdue\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})(?!\s+\d{4})/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const result = parseMatchedDate(match);
      if (result) return result;
    }
  }

  // Second pass: look for dates near due/pay keywords (but not from "Sent:" or forwarded headers)
  const cleanText = cleanedText.replace(/(?:sent|date|from|to|subject)[:\s]*(?:\w+day,?\s*)?\d{1,2}\s+\w+\s+\d{4}/gi, '');

  const contextPatterns = [
    // "due in" ... then a date nearby (within same line)
    /(?:due|pay\s*by)[^\n]{0,30}?(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{4})/i,
    // "due: Fri, 10 July 2026"
    /(?:due|pay)[:\s]*\w{3,},?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{4})/i,
    // DD/MM/YYYY near due keyword
    /(?:due|pay\s*by)[^\n]{0,30}?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
  ];

  for (const pattern of contextPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const result = parseMatchedDate(match);
      if (result) return result;
    }
  }

  // Third pass: any date in the cleaned text (broad fallback)
  const fallbackPattern = /(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})/i;
  const fallbackMatch = cleanText.match(fallbackPattern);
  if (fallbackMatch) {
    const result = parseMatchedDate(fallbackMatch);
    if (result) return result;
  }

  return null;
}

/**
 * Convert a regex match into a YYYY-MM-DD date string.
 */
function parseMatchedDate(match) {
  const months = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  let day, month, year;

  const part1 = (match[1] || '').replace(/^(\d+)(?:st|nd|rd|th)$/i, '$1');
  const part2 = (match[2] || '').replace(/^(\d+)(?:st|nd|rd|th)$/i, '$1');
  const part3 = match[3] || '';

  // Check if first capture is a month name
  if (months[part1.toLowerCase()]) {
    // Format: Month Day Year (e.g., "July 10 2026")
    month = months[part1.toLowerCase()];
    day = part2.padStart(2, '0');
    year = part3;
  } else if (months[part2.toLowerCase()]) {
    // Format: Day Month Year (e.g., "10 July 2026")
    day = part1.padStart(2, '0');
    month = months[part2.toLowerCase()];
    year = part3;
  } else if (!isNaN(part1) && !isNaN(part2) && !isNaN(part3)) {
    // Format: DD/MM/YYYY (Australian format)
    day = part1.padStart(2, '0');
    month = part2.padStart(2, '0');
    year = part3;
  } else {
    return null;
  }

  // Handle missing year (assume current year or next year)
  if (!year || year === '') {
    const now = new Date();
    year = String(now.getFullYear());
  }

  // Handle 2-digit year
  if (year.length === 2) {
    year = '20' + year;
  }

  // Validate
  if (!day || !month || !year) return null;
  if (parseInt(day) > 31 || parseInt(month) > 12) return null;

  try {
    const dateStr = `${year}-${month}-${day}`;
    const parsed = new Date(dateStr + 'T00:00:00');
    if (isNaN(parsed.getTime())) return null;
    return dateStr;
  } catch {
    return null;
  }
}

/**
 * Build a human-readable description from email subject and sender.
 */
function buildDescription(subject, from) {
  const fromName = from.replace(/<.*>/, '').trim().replace(/"/g, '');

  const cleanSubject = subject
    .replace(/^(re:|fwd?:|fw:)\s*/gi, '')
    .replace(/\[.*?\]\s*/g, '')
    .trim();

  if (cleanSubject) {
    return cleanSubject;
  }
  return `Bill from ${fromName}`;
}

/**
 * Get or create a Gmail label called "Processed-Bill".
 */
async function getOrCreateLabel() {
  const oauth2Client = await getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Check if label already exists
  const labels = await gmail.users.labels.list({ userId: 'me' });
  const existing = labels.data.labels.find(l => l.name === 'Processed-Bill');
  if (existing) return existing.id;

  // Create the label
  const newLabel = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: 'Processed-Bill',
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });

  return newLabel.data.id;
}

/**
 * Apply the "Processed-Bill" label to an email.
 */
async function labelEmailAsProcessed(messageId) {
  const oauth2Client = await getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const labelId = await getOrCreateLabel();
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
        removeLabelIds: ['UNREAD'],
      },
    });
    console.log(`Labeled email ${messageId} as Processed-Bill and marked as read`);
  } catch (error) {
    console.warn(`Could not label email ${messageId}:`, error.message);
  }
}

module.exports = {
  getOAuth2Client,
  getAuthUrl,
  handleAuthCallback,
  isAuthenticated,
  fetchBillEmails,
  parseBillEmail,
  labelEmailAsProcessed,
  getEmailBody,
  getEmailHtml,
};
