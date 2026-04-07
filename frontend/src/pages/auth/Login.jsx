import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, Lock, AlertCircle, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const { error } = await signInWithEmail(email, password);
    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-200">
            <span className="text-white text-2xl font-bold">F</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">FinanceTracker</h1>
          <p className="text-gray-500 mt-2">Quản lý tài chính cá nhân</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 rounded-xl flex items-start space-x-3 text-red-600">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Mail size={20} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email đăng nhập"
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-2xl outline-none transition-all"
                required
              />
            </div>
          </div>
          
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Lock size={20} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-2xl outline-none transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-2xl py-4 font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex justify-center items-center h-14"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <div className="h-px bg-gray-200 flex-1"></div>
          <span className="px-4 text-sm text-gray-400">hoặc</span>
          <div className="h-px bg-gray-200 flex-1"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="mt-6 w-full bg-white border border-gray-200 text-gray-700 rounded-2xl py-3.5 font-medium hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center space-x-3 h-14"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
          <span>Đăng nhập với Google</span>
        </button>

        <p className="mt-8 text-center text-sm text-gray-600">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-blue-600 font-semibold hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
