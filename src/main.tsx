import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// تسجيل service worker (FCM background push)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
    // اسجل SW القديم (service-worker.js) — الكاش بتاعه بيتحدث مع v3
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    // لما SW جديد يتفعل (تحديث) — اعمل reload مرة واحدة عشان الكاش القديم يتشال
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.sessionStorage.getItem('sw_reloaded') !== '1') {
        window.sessionStorage.setItem('sw_reloaded', '1');
        window.location.reload();
      }
    });
  });
}
