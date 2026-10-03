import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RoleRoute({ allowedRoles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return allowedRoles.includes(user.role)
    ? <Outlet />
    : <Navigate to="/dashboard" replace />;
}
