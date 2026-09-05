import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { App } from './App';
import { OpsProvider } from './state/opsStore';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OpsProvider>
      <App />
    </OpsProvider>
  </StrictMode>,
);
