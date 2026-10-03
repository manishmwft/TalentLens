import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { candidateLogin, getCandidateSession } from '../services/candidateAuthService.js';

const CandidateAuthContext = createContext(null);
function readAccount() { try { const raw = localStorage.getItem('candidateAccount'); return raw ? JSON.parse(raw) : null; } catch { localStorage.removeItem('candidateAccount'); localStorage.removeItem('candidateAccessToken'); return null; } }

export function CandidateAuthProvider({ children }) {
  const [account, setAccount] = useState(readAccount);
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => { const token = localStorage.getItem('candidateAccessToken'); if (!token) { setCheckingSession(false); return; } getCandidateSession().then(({ account: next }) => { localStorage.setItem('candidateAccount', JSON.stringify(next)); setAccount(next); }).catch(() => { localStorage.removeItem('candidateAccessToken'); localStorage.removeItem('candidateAccount'); setAccount(null); }).finally(() => setCheckingSession(false)); }, []);
  const login = useCallback(async (credentials) => { const data = await candidateLogin(credentials); localStorage.setItem('candidateAccessToken', data.token); localStorage.setItem('candidateAccount', JSON.stringify(data.account)); setAccount(data.account); return data; }, []);
  const saveSession = useCallback((data) => { if (data.token) localStorage.setItem('candidateAccessToken', data.token); if (data.account) { localStorage.setItem('candidateAccount', JSON.stringify(data.account)); setAccount(data.account); } }, []);
  const updateAccount = useCallback((next) => { localStorage.setItem('candidateAccount', JSON.stringify(next)); setAccount(next); }, []);
  const logout = useCallback(() => { localStorage.removeItem('candidateAccessToken'); localStorage.removeItem('candidateAccount'); setAccount(null); }, []);
  const value = useMemo(() => ({ account, checkingSession, login, logout, saveSession, updateAccount }), [account, checkingSession, login, logout, saveSession, updateAccount]);
  return <CandidateAuthContext.Provider value={value}>{children}</CandidateAuthContext.Provider>;
}
export function useCandidateAuth() { const context = useContext(CandidateAuthContext); if (!context) throw new Error('useCandidateAuth must be used inside CandidateAuthProvider'); return context; }
