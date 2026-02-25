import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import StreamerLanding from './components/StreamerLanding.tsx'
import './index.css'

const path = window.location.pathname

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {path === '/streamers' ? <StreamerLanding /> : <App />}
  </React.StrictMode>,
)
