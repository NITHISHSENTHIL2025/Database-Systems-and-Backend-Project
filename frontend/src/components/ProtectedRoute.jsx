import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Spinner } from './UI.jsx';

function roleHome(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'TRAINER') return '/trainer';
  return '/member';
}

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen"><Spinner label="Checking secure session" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}
