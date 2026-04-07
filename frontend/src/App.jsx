import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MobileLayout } from './components/layout/MobileLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Home from './pages/Home';
import Accounts from './pages/Accounts';
import Plan from './pages/Plan';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import TransactionsList from './pages/TransactionsList';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          
          {/* Protected Routes Guard */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MobileLayout />}>
              <Route index element={<Home />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="plan" element={<Plan />} />
              <Route path="statistics" element={<Statistics />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            {/* Standalone screens without bottom tab bar */}
            <Route path="/transactions" element={<TransactionsList />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
