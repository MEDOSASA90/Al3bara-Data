import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';


// زر الرجوع في الموبايل: يرجع للصفحة اللي قبلها داخل التطبيق — مش يقفل التطبيق
// نضيف تاريخ وهمي عند التحميل عشان زر الرجوع الأول يرجع للرئيسية
window.history.pushState({ al3bara: 'root' }, '', window.location.href);
window.addEventListener('popstate', (event) => {
  // لو المستخدم ضغط زر الرجوع ووصل لبداية التاريخ — نرجعه للرئيسية ونضيف تاريخ جديد
  // (التطبيق ميقفلش)
  if (!event.state || !event.state.al3bara) {
    window.history.pushState({ al3bara: 'root' }, '', window.location.href);
  }
  // التنقل الداخلي بيتم عبر hash — نسيبه للـ App
});

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
