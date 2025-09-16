console.log('🚀 main.tsx starting...');
console.log('🌐 Current URL:', window.location.href);
console.log('📱 User Agent:', navigator.userAgent);
console.log('🔧 Environment:', {
  NODE_ENV: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
  hostname: window.location.hostname
});

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './capacitor-setup'

console.log('✅ All imports completed, creating root...');

const rootElement = document.getElementById("root");
console.log('🎯 Root element found:', !!rootElement);

if (!rootElement) {
  console.error('❌ Root element not found!');
} else {
  console.log('✅ Root element found, rendering app...');
  createRoot(rootElement).render(<App />);
  console.log('✅ App rendered successfully!');
}
