import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const storedUser = localStorage.getItem('user');

    if (!storedUser || storedUser === 'undefined' || storedUser === 'null') {
      return null;
    }

    return JSON.parse(storedUser);
  } catch (error) {
    console.error('Invalid stored user session. Clearing local session.', error);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    api.get('/auth/me')
      .then(({ data }) => {
        if (!data?.user) return;
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setUser(null);
      });
  }, []);

  const saveSession = useCallback((data) => {
    if (!data?.token || !data?.user) {
      throw new Error('The authentication server returned an invalid session.');
    }

    localStorage.setItem('accessToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const { data } = await api.post('/auth/login', credentials);
      saveSession(data);
      return data;
    },
    [saveSession],
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload);
      saveSession(data);
      return data;
    },
    [saveSession],
  );

  const updateCurrentUser = useCallback((nextUser) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, register, logout, updateCurrentUser }),
    [user, login, register, logout, updateCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
