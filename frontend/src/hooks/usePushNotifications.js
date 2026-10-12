import { useState, useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BACKEND } from '../api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export function usePushNotifications(user, showToast) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    // Check if push is supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(supported);

    if (supported && Notification.permission === 'granted') {
      setPushEnabled(true);
      registerToken();
    }
  }, [user]);

  useEffect(() => {
    if (!pushEnabled || !pushSupported) return;

    try {
      const messaging = getMessaging();
      // Handle foreground messages
      const unsubscribe = onMessage(messaging, (payload) => {
        const { title, body } = payload.notification || {};
        if (showToast) {
          showToast(body || title || 'New notification', 'info', 5000);
        }
        // Also show native notification if in foreground
        if (Notification.permission === 'granted') {
          new Notification(title || 'Bill Reminder', {
            body: body || '',
            icon: '/icon-192.svg',
          });
        }
      });
      return unsubscribe;
    } catch (err) {
      console.warn('FCM foreground listener error:', err);
    }
  }, [pushEnabled, pushSupported, showToast]);

  async function registerToken() {
    try {
      const messaging = getMessaging();
      // Register the Firebase Messaging service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token && user) {
        // Save token to Firestore so backend can send pushes
        await setDoc(doc(db, 'push_tokens', user.uid), {
          token,
          email: user.email,
          updated_at: new Date().toISOString(),
        });
        console.log('Push token saved');
      }
    } catch (err) {
      console.error('Failed to get push token:', err);
    }
  }

  async function enablePush() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushEnabled(true);
        await registerToken();
        if (showToast) showToast('Push notifications enabled!', 'success');
      } else {
        if (showToast) showToast('Notification permission denied', 'error');
      }
    } catch (err) {
      console.error('Push enable error:', err);
      if (showToast) showToast('Failed to enable notifications: ' + err.message, 'error');
    }
  }

  function disablePush() {
    setPushEnabled(false);
    if (showToast) showToast('Push notifications disabled', 'info');
  }

  return { pushEnabled, pushSupported, enablePush, disablePush };
}
