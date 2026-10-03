import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CandidateAuthProvider } from './context/CandidateAuthContext.jsx';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found in index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CandidateAuthProvider>
          <App />
        </CandidateAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
