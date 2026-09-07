import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './terminal.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  globalThis.window?.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('sw.js', document.baseURI);
    void navigator.serviceWorker.register(serviceWorkerUrl, { scope: './' }).catch((error) => {
      console.warn('BLACK ORACLE PWA service worker registration failed.', error);
    });
  });
}
