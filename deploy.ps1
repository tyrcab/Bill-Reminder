# Deploy script for Bill Reminder
# Deploys both PWA (Firebase Hosting) and Backend (Cloud Run)

$ErrorActionPreference = "Stop"
$PROJECT_ID = "bill-reminder-73a35"
$REGION = "australia-southeast1"
$SERVICE_NAME = "bill-reminder-api"

Write-Host "=== Bill Reminder Deploy ===" -ForegroundColor Cyan

# Step 1: Build frontend
Write-Host "`n[1/4] Building frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run build
Set-Location ..

# Step 2: Deploy to Firebase Hosting
Write-Host "`n[2/4] Deploying PWA to Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting --project $PROJECT_ID

# Step 3: Deploy backend to Cloud Run
Write-Host "`n[3/4] Deploying backend to Cloud Run..." -ForegroundColor Yellow
Set-Location backend
gcloud run deploy $SERVICE_NAME `
  --source . `
  --region $REGION `
  --project $PROJECT_ID `
  --allow-unauthenticated `
  --set-env-vars "NODE_ENV=production,TIMEZONE=Australia/Sydney" `
  --set-secrets "TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest,TELEGRAM_CHAT_ID=TELEGRAM_CHAT_ID:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest"
Set-Location ..

# Step 4: Deploy Firestore rules
Write-Host "`n[4/4] Deploying Firestore rules..." -ForegroundColor Yellow
firebase deploy --only firestore --project $PROJECT_ID

Write-Host "`n=== Deploy Complete ===" -ForegroundColor Green
Write-Host "PWA: https://$PROJECT_ID.web.app"
Write-Host "API: https://$SERVICE_NAME-xxxxxxxxxx-ts.a.run.app"
