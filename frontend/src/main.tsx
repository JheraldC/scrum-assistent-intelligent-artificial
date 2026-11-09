import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { ErrorBoundary } from './app/ErrorBoundary';
import { SessionProvider } from './app/SessionProvider';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </ErrorBoundary>
  </StrictMode>,
);
