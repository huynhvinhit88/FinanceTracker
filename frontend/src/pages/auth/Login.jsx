import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getGoogleUserInfo } from '../../lib/syncService';
import { ShieldCheck, LockOpen, AlertCircle, ArrowRight } from 'lucide-react';

const GoogleIcon = ({ size = 24, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
  </svg>
);

const Login = () => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { hasPin, setupPin, unlock, googleUser, confirmGoogleUser } = useAuth();

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const userInfo = await getGoogleUserInfo();
      if (userInfo && userInfo.email) {
        confirmGoogleUser(userInfo);
      } else {
        setError('Không thể lấy thông tin người dùng Google. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi khi đăng nhập Google: ' + (err.message || 'Vui lòng kiểm tra quyền truy cập.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!hasPin) {
        if (pin.length < 4) {
          setError('PIN must be at least 4 digits');
          return;
        }
        if (pin !== confirmPin) {
          setError('PINs do not match');
          return;
        }
        await setupPin(pin);
        navigate('/');
      } else {
        const { error: unlockError } = await unlock(pin);
        if (unlockError) {
          setError(unlockError);
          setPin('');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Stage 1: Identity Gate (Google)
  if (!googleUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300 px-4">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-gray-100 dark:border-white/5 flex items-center justify-center">
              <GoogleIcon size={40} />
            </div>
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight mb-2">
            Xác thực Danh tính
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mb-10 max-w-xs mx-auto leading-relaxed">
            Vui lòng đăng nhập Google để xác nhận quyền truy cập ứng dụng
          </p>

          <div className="bg-white dark:bg-slate-900 py-10 px-8 shadow-2xl shadow-slate-200/50 dark:shadow-none rounded-[2.5rem] border border-gray-100 dark:border-white/10">
            {error && (
              <div className="mb-6 rounded-2xl bg-red-50 dark:bg-rose-900/20 p-4 border border-red-100 dark:border-rose-900/30 transition-colors">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-500 dark:text-rose-400 shrink-0" />
                  <p className="ml-3 text-sm font-bold text-red-800 dark:text-rose-400 text-left">{error}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-16 flex items-center justify-center space-x-4 bg-gray-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-500 text-white rounded-2xl font-black transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-gray-200 dark:shadow-none"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <GoogleIcon size={22} />
                  <span className="uppercase tracking-widest text-sm">Tiếp tục với Google</span>
                </>
              )}
            </button>
            <p className="mt-6 text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] leading-loose px-4">
              Chỉ email được cấp quyền (Test Users) mới có thể đăng nhập thành công.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Stage 2: Security Gate (PIN)
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center border border-blue-200 dark:border-blue-900/50">
            {hasPin ? (
              <LockOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            )}
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
          {hasPin ? 'Mở khóa Ứng dụng' : 'Thiết lập mã PIN'}
        </h2>
        <div className="mt-2 flex items-center justify-center space-x-2">
          <span className="text-xs font-black text-blue-600 dark:text-indigo-400 bg-blue-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-indigo-900/50">
            {googleUser.email.split('@')[0]}
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl shadow-slate-200/50 dark:shadow-none sm:rounded-3xl sm:px-10 border border-gray-100 dark:border-white/5 mx-4 sm:mx-0">
          <form className="space-y-6" onSubmit={handlePinSubmit}>
            <div>
              <label htmlFor="pin" className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">
                {hasPin ? 'Mã PIN' : 'Mã PIN Mới'}
              </label>
              <div className="mt-1">
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="appearance-none block w-full px-3 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-gray-100 dark:border-white/5 rounded-2xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-indigo-500 focus:border-transparent text-center tracking-[1em] text-2xl font-black transition-all"
                  placeholder="••••"
                  maxLength={6}
                />
              </div>
            </div>

            {!hasPin && (
              <div>
                <label htmlFor="confirmPin" className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">
                  Xác nhận mã PIN
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPin"
                    name="confirmPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="appearance-none block w-full px-3 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-gray-100 dark:border-white/5 rounded-2xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-indigo-500 focus:border-transparent text-center tracking-[1em] text-2xl font-black transition-all"
                    placeholder="••••"
                    maxLength={6}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-red-50 dark:bg-rose-900/20 p-4 border border-red-100 dark:border-rose-900/30 transition-colors">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400 dark:text-rose-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-red-800 dark:text-rose-400">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 flex items-center justify-center py-2 px-4 border border-transparent rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none text-base font-black text-white bg-blue-600 dark:bg-indigo-600 hover:bg-blue-700 dark:hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 uppercase tracking-wider"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                ) : null}
                <span>{isLoading ? 'Đang xử lý...' : hasPin ? 'Mở khóa' : 'Lưu mã PIN'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
