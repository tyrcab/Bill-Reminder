import React, { useState, useCallback } from 'react';
import App from './App';
import LoginScreen from './components/LoginScreen';
import PinLock from './components/PinLock';
import LoadingSkeleton from './components/LoadingSkeleton';
import { useAuth } from './hooks/useAuth';

function AuthWrapper() {
  const { user, authLoading, isAdmin, loginWithGoogle, loginWithEmail, signUpWithEmail, logout } = useAuth();
  const [loginLoading, setLoginLoading] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState(() => {
    // Use sessionStorage so pull-to-refresh doesn't re-ask for PIN
    // sessionStorage clears when the app/tab is fully closed
    return sessionStorage.getItem('pin_unlocked') === 'true';
  });

  const hasPin = !!localStorage.getItem('app_pin');

  const handleLoginGoogle = async () => {
    setLoginLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLoginEmail = async (email, password) => {
    setLoginLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setLoginLoading(false);
      throw err;
    }
    setLoginLoading(false);
  };

  const handleSignUp = async (email, password, displayName) => {
    setLoginLoading(true);
    try {
      await signUpWithEmail(email, password, displayName);
    } catch (err) {
      setLoginLoading(false);
      throw err;
    }
    setLoginLoading(false);
  };

  const handleUnlock = useCallback(() => {
    setPinUnlocked(true);
    sessionStorage.setItem('pin_unlocked', 'true');
  }, []);

  // Loading state
  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="login-icon">🔔</div>
        <LoadingSkeleton />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <LoginScreen
        onLoginGoogle={handleLoginGoogle}
        onLoginEmail={handleLoginEmail}
        onSignUp={handleSignUp}
        loading={loginLoading}
      />
    );
  }

  // Logged in but PIN locked
  if (hasPin && !pinUnlocked) {
    return <PinLock onUnlock={handleUnlock} />;
  }

  // Fully authenticated
  return <App user={user} logout={logout} isAdmin={isAdmin} />;
}

export default AuthWrapper;
