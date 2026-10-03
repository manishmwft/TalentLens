import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
export default function ProtectedRoute() {
  const { user } = useAuth(); const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && !(location.pathname === '/profile' && new URLSearchParams(location.search).get('tab') === 'security')) return <Navigate to="/profile?tab=security" replace />;
  return <Outlet />;
}
