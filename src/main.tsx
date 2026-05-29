import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { store } from './app/store';
import ThemeWrapper from './theme/ThemeWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import { addStatusEntry, installUnloadFlushListener } from './features/status/statusSlice';

// Log session start
store.dispatch(addStatusEntry({ level: 'session', message: 'New session established' }));

// #183 unload-flush arm: drain the coalesced status-log buffer on tab
// close / backgrounding so the tail of a long-running operation's log
// (up to 50 entries / 250ms worth) survives reload. The handler stays
// installed for the lifetime of the page; no uninstaller bookkeeping
// needed at the app root.
installUnloadFlushListener();

// Expose Redux store on window for Cypress E2E testing
if (import.meta.env.DEV) {
  (window as any).__store__ = store;
}

// Register service worker for streaming downloads in web-app mode
if ('serviceWorker' in navigator && !(typeof chrome !== 'undefined' && chrome.runtime?.id)) {
  navigator.serviceWorker.register('/sw.js');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeWrapper>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeWrapper>
    </Provider>
  </React.StrictMode>
);
