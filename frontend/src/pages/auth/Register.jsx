import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    
    const { data, error: signUpError } = await signUp(email, password, name);
    
    if (signUpError) {
      setError(signUpError.message);
    } else {
      // If auto-confirm is off in Supabase, session will be null
      if (data?.session === null) {
        setSuccessMsg('Đăng ký thành công! Vui lòng kiểm tra hộp thư Email của bạn để kích hoạt tài khoản trước khi đăng nhập.');
      } else {
        navigate('/');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Tạo tài khoản mới</h1>
          <p className="text-gray-500 mt-2">Bắt đầu quản lý tài chính chuẩn xác</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 rounded-xl flex items-start space-x-3 text-red-600">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 rounded-xl flex items-start space-x-3 text-green-700">
            <p className="text-sm font-medium">{successMsg}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <UserIcon size={20} />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên hiển thị"
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-2xl outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Mail size={20} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email đăng ký"
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
                placeholder="Mật khẩu (ít nhất 6 ký tự)"
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-2xl outline-none transition-all"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-2xl py-4 font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex justify-center items-center h-14 mt-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Đăng ký tài khoản'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
