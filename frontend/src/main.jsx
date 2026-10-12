import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthWrapper from './AuthWrapper';
import { ToastProvider } from './components/Toast';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthWrapper />
    </ToastProvider>
  </React.StrictMode>
);
