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
