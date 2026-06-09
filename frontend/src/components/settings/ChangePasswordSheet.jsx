import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, AlertCircle, CheckCircle2, X } from 'lucide-react';

export function ChangePasswordSheet({ isOpen, onClose }) {
  const { updatePassword } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation (Supabase yêu cầu mật khẩu tối thiểu 6 ký tự)
    if (oldPassword.length < 6 || newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp nhau');
      return;
    }
    if (oldPassword === newPassword) {
      setError('Mật khẩu mới phải khác mật khẩu cũ');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await updatePassword(oldPassword, newPassword);
      if (updateError) {
        setError(updateError);
      } else {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (err) {
      setError('Đã có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 border-none dark:border dark:border-white/5 mx-auto pb-safe">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
          <h2 className="text-xl font-black text-gray-900 dark:text-slate-100 flex items-center">
            <ShieldCheck className="mr-2 text-blue-600 dark:text-indigo-400" size={24} />
            Đổi mật khẩu
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <div className="w-20 h-20 bg-green-50 dark:bg-emerald-900/10 rounded-full flex items-center justify-center text-green-500 dark:text-emerald-400 animate-bounce">
                <CheckCircle2 size={48} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Đổi mật khẩu thành công!</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Mật khẩu mới của bạn đã được cập nhật.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2 pl-1">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:focus:border-indigo-500 rounded-2xl px-5 py-4 text-base font-semibold text-gray-900 dark:text-slate-100 transition-all outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-white/5">
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2 pl-1">Mật khẩu mới</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:focus:border-indigo-500 rounded-2xl px-5 py-4 text-base font-semibold text-gray-900 dark:text-slate-100 transition-all outline-none"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2 pl-1">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:focus:border-indigo-500 rounded-2xl px-5 py-4 text-base font-semibold text-gray-900 dark:text-slate-100 transition-all outline-none"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-500 dark:text-rose-400 bg-red-50 dark:bg-rose-900/10 px-4 py-3 rounded-2xl border border-red-100 dark:border-rose-900/30">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="text-xs font-bold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gray-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-gray-200 dark:shadow-none active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 uppercase tracking-widest text-sm"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Cập nhật mật khẩu</span>
                )}
              </button>

              <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center font-medium italic">
                Lưu ý: Bạn sẽ dùng mật khẩu mới này cho lần đăng nhập tiếp theo.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
