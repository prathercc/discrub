import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { store } from './app/store';
import ThemeWrapper from './theme/ThemeWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import { addStatusEntry } from './features/status/statusSlice';

// Log session start
store.dispatch(addStatusEntry({ level: 'session', message: 'New session established' }));

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
