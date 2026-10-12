// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCCLPJ4H8qSMgPX84e-t-_sr-NLlrriAnQ',
  authDomain: 'bill-reminder-73a35.firebaseapp.com',
  projectId: 'bill-reminder-73a35',
  storageBucket: 'bill-reminder-73a35.firebasestorage.app',
  messagingSenderId: '976013177911',
  appId: '1:976013177911:web:00be8ef4ca6464c0c5bbb2',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};

  self.registration.showNotification(title || 'Bill Reminder', {
    body: body || 'You have a notification',
    icon: icon || '/icon-192.svg',
    badge: '/icon-192.svg',
    vibrate: [200, 100, 200],
    data: payload.data,
  });
});
