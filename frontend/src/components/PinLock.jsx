import React, { useState, useEffect } from 'react';

function PinLock({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState('enter'); // 'enter' or 'confirm'

  const storedPin = localStorage.getItem('app_pin');
  const hasPin = !!storedPin;

  useEffect(() => {
    if (!hasPin) {
      // No PIN set — skip lock
      onUnlock();
    }
  }, [hasPin, onUnlock]);

  function handleKeyPress(digit) {
    if (isSettingPin) {
      if (step === 'enter') {
        const newPin = pin + digit;
        setPin(newPin);
        setError('');
        if (newPin.length === 4) {
          setConfirmPin(newPin);
          setPin('');
          setStep('confirm');
        }
      } else {
        const newPin = pin + digit;
        setPin(newPin);
        setError('');
        if (newPin.length === 4) {
          if (newPin === confirmPin) {
            localStorage.setItem('app_pin', newPin);
            onUnlock();
          } else {
            setError('PINs don\'t match. Try again.');
            setPin('');
            setStep('enter');
            setConfirmPin('');
          }
        }
      }
    } else {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      if (newPin.length === 4) {
        if (newPin === storedPin) {
          onUnlock();
        } else {
          setError('Incorrect PIN');
          setPin('');
        }
      }
    }
  }

  function handleDelete() {
    setPin(pin.slice(0, -1));
  }

  // If no PIN is set, don't render (useEffect will call onUnlock)
  if (!hasPin && !isSettingPin) return null;

  return (
    <div className="pin-lock">
      <div className="pin-card">
        <div className="pin-icon">🔒</div>
        <h2>{isSettingPin ? (step === 'enter' ? 'Set a PIN' : 'Confirm PIN') : 'Enter PIN'}</h2>
        <p className="pin-subtitle">
          {isSettingPin ? 'Choose a 4-digit PIN' : 'Enter your 4-digit PIN to continue'}
        </p>

        <div className="pin-dots">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
          ))}
        </div>

        {error && <p className="pin-error">{error}</p>}

        <div className="pin-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, i) => (
            <button
              key={i}
              className={`pin-key ${key === null ? 'empty' : ''} ${key === 'del' ? 'del' : ''}`}
              onClick={() => {
                if (key === 'del') handleDelete();
                else if (key !== null) handleKeyPress(String(key));
              }}
              disabled={key === null}
            >
              {key === 'del' ? '⌫' : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PinSetup({ onComplete }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState('enter');
  const [error, setError] = useState('');

  function handleKeyPress(digit) {
    if (step === 'enter') {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      if (newPin.length === 4) {
        setTimeout(() => {
          setConfirmPin(newPin);
          setPin('');
          setStep('confirm');
        }, 200);
      }
    } else {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      if (newPin.length === 4) {
        if (newPin === confirmPin) {
          localStorage.setItem('app_pin', newPin);
          onComplete();
        } else {
          setError('PINs don\'t match. Try again.');
          setPin('');
          setStep('enter');
          setConfirmPin('');
        }
      }
    }
  }

  function handleDelete() {
    setPin(pin.slice(0, -1));
  }

  return (
    <div className="pin-setup">
      <h3>{step === 'enter' ? 'Create a 4-digit PIN' : 'Confirm your PIN'}</h3>

      <div className="pin-dots">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>

      {error && <p className="pin-error">{error}</p>}

      <div className="pin-keypad compact">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, i) => (
          <button
            key={i}
            className={`pin-key ${key === null ? 'empty' : ''} ${key === 'del' ? 'del' : ''}`}
            onClick={() => {
              if (key === 'del') handleDelete();
              else if (key !== null) handleKeyPress(String(key));
            }}
            disabled={key === null}
          >
            {key === 'del' ? '⌫' : key}
          </button>
        ))}
      </div>
    </div>
  );
}

export default PinLock;
