import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { NotificationProvider } from './store/NotificationContext'
import { DbProvider } from './store/DbContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotificationProvider>
      <DbProvider>
        <App />
      </DbProvider>
    </NotificationProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Service Worker registered with scope:', reg.scope);
        // Force check for update immediately
        reg.update();
        // When a new SW is found, reload to activate it
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                console.log('New Service Worker activated, reloading...');
                window.location.reload();
              }
            });
          }
        });
      })
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}
