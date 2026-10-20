// Intercept console.error and console.warn to filter known benign background noise (iframe postMessage / TradingView / Firestore quota)
const origConsoleError = console.error;
const origConsoleWarn = console.warn;

const shouldFilterMsg = (...args: any[]) => {
  const str = args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a && a.message) return a.message;
      try {
        return JSON.stringify(a);
      } catch (e) {
        return String(a);
      }
    })
    .join(' ');
  return (
    str.includes('RESOURCE_EXHAUSTED') ||
    str.includes('Quota limit exceeded') ||
    str.includes('contentWindow') ||
    str.includes('Cannot listen to the event') ||
    str.includes('GrpcConnection RPC') ||
    str.includes('TradingView')
  );
};

console.error = (...args: any[]) => {
  if (shouldFilterMsg(...args)) return;
  origConsoleError.apply(console, args);
};

console.warn = (...args: any[]) => {
  if (shouldFilterMsg(...args)) return;
  origConsoleWarn.apply(console, args);
};

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Suppress or catch cross-origin script errors and iframe postMessage warnings from embedded widgets (e.g. TradingView)
window.addEventListener(
  'message',
  (event) => {
    try {
      if (!event || !event.source) {
        return;
      }
    } catch (e) {
      // Ignore cross-origin / detached contentWindow access errors
    }
  },
  { capture: true, passive: true },
);

const handleGlobalError = (event: ErrorEvent) => {
  const msg = (event && (event.message || (event.error && event.error.message))) || '';
  if (
    msg === 'Script error.' ||
    msg.includes('contentWindow') ||
    msg.includes('iframe') ||
    msg.includes('TradingView') ||
    msg.includes('Cannot listen to the event') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota limit exceeded')
  ) {
    if (event.preventDefault) event.preventDefault();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    return true;
  }
};

window.addEventListener('error', handleGlobalError, true);

window.addEventListener('unhandledrejection', (event) => {
  const reason = (event && event.reason && (event.reason.message || String(event.reason))) || '';
  if (
    reason.includes('contentWindow') ||
    reason.includes('iframe') ||
    reason.includes('TradingView') ||
    reason.includes('Cannot listen to the event') ||
    reason.includes('RESOURCE_EXHAUSTED') ||
    reason.includes('Quota limit exceeded')
  ) {
    if (event.preventDefault) event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
