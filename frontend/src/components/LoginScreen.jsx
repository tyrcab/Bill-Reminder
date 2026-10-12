import React, { useState } from 'react';

function LoginScreen({ onLoginGoogle, onLoginEmail, onSignUp, loading }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'signup') {
        await onSignUp(email, password, displayName);
      } else {
        await onLoginEmail(email, password);
      }
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' ? 'Invalid email or password'
        : err.code === 'auth/email-already-in-use' ? 'Email already registered. Try signing in.'
        : err.code === 'auth/weak-password' ? 'Password must be at least 6 characters'
        : err.code === 'auth/invalid-email' ? 'Invalid email address'
        : err.message;
      setError(msg);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">🔔</div>
        <h1>Bill Reminder</h1>
        <p>{mode === 'signup' ? 'Create your account' : 'Sign in to access your bills'}</p>

        {error && <div className="login-error">{error}</div>}

        {/* Email/Password Form */}
        <form onSubmit={handleEmailSubmit} className="login-form">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="login-input"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="login-input"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="login-input"
            required
            minLength={6}
          />
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? '⏳...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        {/* Google Sign-In */}
        <button
          className="btn btn-google"
          onClick={onLoginGoogle}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: '8px' }}>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.48 0 2.438 2.017.956 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z"/>
          </svg>
          Sign in with Google
        </button>

        {/* Toggle login/signup */}
        <p className="login-toggle">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => { setMode('signup'); setError(''); }}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('login'); setError(''); }}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}

export default LoginScreen;
