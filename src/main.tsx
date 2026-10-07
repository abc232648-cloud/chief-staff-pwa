import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { OfflineQueueProvider } from './offline/OfflineQueueContext';
import { registerStaffServiceWorker } from './pwa/register';
import './index.css';
import './auth/auth.css';
import './features/today/today.css';

void registerStaffServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <OfflineQueueProvider>
        <HashRouter><App /></HashRouter>
      </OfflineQueueProvider>
    </AuthProvider>
  </React.StrictMode>
);
