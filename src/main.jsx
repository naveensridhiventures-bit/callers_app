import React from 'react'
import { createRoot } from 'react-dom/client'
import './install'
import App from './App'
import './styles.css'
import './theme.css'
import './location.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
