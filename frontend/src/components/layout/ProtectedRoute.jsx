import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Nếu người dùng chưa xác thực, chuyển hướng về trang /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Nếu đã xác thực, cho phép render các view con (như MobileLayout, Home...)
  return <Outlet />;
}
