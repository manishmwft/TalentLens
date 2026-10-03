import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCandidateAuth } from '../../context/CandidateAuthContext.jsx';

export default function CandidateProtectedRoute({ requirePasswordChanged = false }) {
  const { account, checkingSession } = useCandidateAuth();
  const location = useLocation();

  if (checkingSession) {
    return <div className="grid min-h-screen place-items-center bg-[#070b14] text-sm font-bold text-slate-400">Checking candidate session…</div>;
  }

  if (!account) {
    return <Navigate to="/candidate/login" replace state={{ from: location.pathname }} />;
  }

  if (requirePasswordChanged && account.mustChangePassword) {
    return <Navigate to="/candidate/change-password" replace />;
  }

  return <Outlet />;
}
