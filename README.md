# Bill Reminder

A bill reminder system that reads bills from Gmail, creates Google Calendar reminders, sends Telegram notifications, and provides a PWA hosted on Firebase.

## Features

- **Gmail Integration** - Automatically scans your inbox for bill emails and extracts amount, due date, and description
- **Google Calendar** - Creates calendar events with reminders (2 days, 1 day, and 1 hour before due date)
- **Telegram Notifications** - Sends bill alerts to your Telegram bot:
  ```
  🔔 BILL ALERT

  💰 Amount: AUD 287.19
  📅 Due: Thu Jul 23 2026
  📋 Bill: Gas Bill 6 May 2026 - 1 July 2026
  ```
- **Firebase Firestore** - Cloud database for bills, real-time sync to frontend
- **Firebase Hosting** - PWA hosted with CDN, SSL, and custom domain support
- **Real-time Updates** - Frontend auto-updates when bills change (Firestore onSnapshot)
- **PWA Frontend** - Installable app to view, add, and manage bills from any device
- **Manual Bills** - Add bills that don't come via email (rent, subscriptions, etc.)
- **Scheduled Jobs** - Auto-scans Gmail every 4 hours, sends reminders at 8am, daily summary on weekdays at 7am

## Project Structure

```
Bill-Reminder/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js        # Firestore database layer
│   │   ├── routes/
│   │   │   ├── auth.js            # Google OAuth2 flow
│   │   │   ├── bills.js           # CRUD API for bills
│   │   │   └── scan.js            # Gmail scan trigger
│   │   ├── services/
│   │   │   ├── calendar.js        # Google Calendar integration
│   │   │   ├── gmail.js           # Gmail API + email parsing
│   │   │   ├── scheduler.js       # Cron jobs
│   │   │   └── telegram.js        # Telegram Bot API
│   │   └── index.js               # Express server entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddBillForm.jsx    # Manual bill entry form
│   │   │   ├── BillCard.jsx       # Individual bill display
│   │   │   ├── BillList.jsx       # Bill list with sections
│   │   │   └── Header.jsx         # App header with actions
│   │   ├── hooks/
│   │   │   └── useBills.js        # Real-time Firestore hook
│   │   ├── firebase.js            # Firebase client config
│   │   ├── api.js                 # Backend API calls (scan, auth)
│   │   ├── App.jsx                # Main app component
│   │   ├── main.jsx               # Entry point
│   │   └── styles.css             # Styles
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── firebase.json                   # Firebase Hosting + Firestore config
├── firestore.rules                 # Firestore security rules
├── firestore.indexes.json          # Firestore composite indexes
├── .firebaserc                     # Firebase project alias
└── package.json                    # Root scripts
```

## Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Firestore enabled
- A Google Cloud project with Gmail and Calendar APIs enabled
- A Telegram bot (created via [@BotFather](https://t.me/BotFather))

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/Bill-Reminder.git
cd Bill-Reminder
npm run install:all
```

### 2. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Firestore Database** (start in production mode)
4. Go to **Project Settings** > **Service Accounts** > **Generate New Private Key**
5. Save the JSON file as `backend/data/serviceAccountKey.json`
6. Go to **Project Settings** > **General** > **Your Apps** > Add a **Web App**
7. Copy the Firebase config values

### 3. Google Cloud Setup

1. In your Firebase project (which is also a Google Cloud project), enable:
   - **Gmail API**
   - **Google Calendar API**
2. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client IDs**
3. Set application type to **Web application**
4. Add authorized redirect URI: `http://localhost:3001/auth/google/callback`
5. Copy the Client ID and Client Secret

### 4. Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token
4. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)

### 5. Configure Environment

**Backend** (`backend/.env`):
```bash
cd backend
copy .env.example .env
```

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./data/serviceAccountKey.json

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

PORT=3001
FRONTEND_URL=http://localhost:5173
TIMEZONE=Australia/Sydney
```

**Frontend** (`frontend/.env`):
```bash
cd frontend
copy .env.example .env
```

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 6. Firebase CLI Setup

```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id
```

Update `.firebaserc` with your project ID.

### 7. Deploy Firestore Rules & Indexes

```bash
npm run deploy:firestore
```

### 8. Run Locally

```bash
# Terminal 1 - Backend
npm run backend:dev

# Terminal 2 - Frontend
npm run frontend:dev
```

### 9. Deploy PWA to Firebase Hosting

```bash
npm run deploy:hosting
```

Or deploy everything (hosting + firestore rules):
```bash
npm run deploy
```

## Usage

### Add a bill manually
Click **+ Add Bill**, fill in the description, amount, and due date. The backend will:
- Save it to Firestore
- Create a Google Calendar event with reminders
- Send a Telegram notification
- Frontend updates automatically via real-time listener

### Scan Gmail
Click **Scan Gmail** to check for new bill emails. The scanner looks for keywords like "bill", "invoice", "payment due" and extracts the amount and due date.

### Automatic reminders
The scheduler runs automatically:
- **Every 4 hours**: Scans Gmail for new bills
- **8am daily**: Sends Telegram reminders for bills due within 3 days
- **7am weekdays**: Sends a summary of all upcoming bills (next 2 weeks)

### Mark as paid
Click **Paid** on a bill card. The status updates in real-time.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bills` | Get all bills (query: `?status=pending`) |
| GET | `/api/bills/upcoming?days=7` | Get bills due within N days |
| GET | `/api/bills/:id` | Get a single bill |
| POST | `/api/bills` | Create a bill |
| PUT | `/api/bills/:id` | Update a bill |
| DELETE | `/api/bills/:id` | Delete a bill |
| POST | `/api/bills/:id/notify` | Resend Telegram notification |
| POST | `/api/scan` | Trigger Gmail scan |
| GET | `/auth/status` | Check Google auth status |
| GET | `/auth/google` | Start OAuth flow |
| POST | `/api/test-telegram` | Send test Telegram message |

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Firebase       │     │   Backend        │     │   External APIs  │
│   Hosting (PWA)  │────▶│   (Express)      │────▶│   - Gmail API    │
│                  │     │                  │     │   - Calendar API │
│   Real-time      │◀───▶│   Firestore      │     │   - Telegram Bot │
│   Firestore      │     │   (Admin SDK)    │     └──────────────────┘
└──────────────────┘     └──────────────────┘
```

- **Frontend** reads bills directly from Firestore (real-time updates)
- **Backend** writes to Firestore and handles Gmail/Calendar/Telegram integrations
- Firestore rules allow read from frontend, write only from Admin SDK (backend)

## Tech Stack

- **Backend**: Node.js, Express, Firebase Admin SDK, googleapis, node-cron
- **Frontend**: React, Vite, Firebase Client SDK, vite-plugin-pwa
- **Database**: Firebase Firestore
- **Hosting**: Firebase Hosting
- **Integrations**: Gmail API, Google Calendar API, Telegram Bot API

## License

MIT
