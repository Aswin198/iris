import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tokens.css';

import { Root } from './App';

import {
  DispatcherProvider,
} from './state/dispatcherStore';


createRoot(
  document.getElementById('root')!
).render(
  <StrictMode>
    <DispatcherProvider>
      <Root />
    </DispatcherProvider>
  </StrictMode>,
);