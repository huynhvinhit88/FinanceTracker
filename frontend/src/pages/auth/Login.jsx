import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, LogIn, UserPlus } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setMessage('Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác nhận (hoặc đăng nhập nếu email confirmation đã tắt).');
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[2rem] shadow-xl flex items-center justify-center text-white text-3xl font-bold">
            💰
          </div>
        </div>
        <h2 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight mb-2">
          {isSignUp ? 'Đăng ký tài khoản' : 'Đăng nhập ứng dụng'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mb-10 max-w-xs mx-auto leading-relaxed">
          Quản lý tài chính cá nhân thông minh và đồng bộ hóa qua Supabase Cloud
        </p>

        <div className="bg-white dark:bg-slate-900 py-10 px-8 shadow-2xl shadow-slate-200/50 dark:shadow-none rounded-[2.5rem] border border-gray-100 dark:border-white/10 text-left">
          {error && (
            <div className="mb-6 rounded-2xl bg-red-50 dark:bg-rose-900/20 p-4 border border-red-100 dark:border-rose-900/30">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-rose-400 shrink-0" />
                <p className="ml-3 text-sm font-bold text-red-800 dark:text-rose-400">{error}</p>
              </div>
            </div>
          )}

          {message && (
            <div className="mb-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex">
                <div className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0">✓</div>
                <p className="ml-3 text-sm font-bold text-emerald-800 dark:text-emerald-400">{message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">
                Địa chỉ Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 dark:text-slate-100 rounded-xl px-4 py-3.5 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 dark:text-slate-100 rounded-xl px-4 py-3.5 outline-none transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-2xl font-black transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-blue-200 dark:shadow-none"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
                  <span className="uppercase tracking-widest text-xs">{isSignUp ? 'Đăng ký' : 'Đăng nhập'}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setMessage(null);
              }}
              className="text-xs font-bold text-blue-600 dark:text-indigo-400 hover:underline uppercase tracking-wider"
            >
              {isSignUp ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
