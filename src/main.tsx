import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const canRegisterPwa =
  'serviceWorker' in navigator &&
  (window.location.protocol === 'https:' || window.location.hostname === 'localhost');

if (canRegisterPwa) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      const checkForUpdate = () => registration.update().catch(() => undefined);

      // Installed PWAs can stay open for long periods. Check the app shell again
      // when the user returns and periodically while it is running.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void checkForUpdate();
      });
      window.addEventListener('online', () => void checkForUpdate());
      window.setInterval(() => void checkForUpdate(), 5 * 60 * 1000);
    }).catch(() => {
      // PWA registration failure must never block the trading UI.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
