import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, LockOpen, AlertCircle, ArrowRight } from 'lucide-react';

const Login = () => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { hasPin, setupPin, unlock } = useAuth();

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
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
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400 font-medium">
          {hasPin 
            ? 'Vui lòng nhập mã PIN để truy cập dữ liệu tài chính của bạn' 
            : 'Bảo mật dữ liệu của bạn bằng mã PIN mới'}
        </p>
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
