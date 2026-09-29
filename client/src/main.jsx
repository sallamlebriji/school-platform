import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui';
import { I18nProvider } from './i18n';
import 'leaflet/dist/leaflet.css';
import './styles/base.css';
import './styles/app.css';
import './styles/client.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
