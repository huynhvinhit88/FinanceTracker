import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';

export function AddGoalSheet({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: rawTarget, handleInputChange, reset: resetAmount, suffix } = useCurrencyInput('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tên mục tiêu không được bỏ trống');
      return;
    }
    if (rawTarget <= 0) {
      setError('Số tiền mục tiêu phải lớn hơn 0');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      await db.goals.add({
        id: crypto.randomUUID(),
        name: name.trim(),
        target_amount: rawTarget,
        current_amount: 0,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        status: 'active'
      });
      
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi thêm mục tiêu');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    resetAmount();
    setName('');
    setDeadline('');
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Tạo mục tiêu tiết kiệm">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền cẩn đạt (Mục tiêu)</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              placeholder="0"
              className="w-full bg-gray-50 text-green-600 text-3xl font-bold py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 focus:ring-green-500 transition-all outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-300">{suffix}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tên mục tiêu</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ví dụ: Mua iPhone 16..."
            className="w-full bg-gray-50 border border-transparent focus:border-green-500 rounded-xl px-4 py-3 outline-none transition-colors"
          />
        </div>

        <div>
           <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày dự kiến hoàn thành (Tùy chọn)</label>
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="w-full bg-gray-50 border border-transparent focus:border-green-500 rounded-xl px-4 py-3 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-green-600 text-white font-semibold rounded-2xl shadow-lg shadow-green-200 active:scale-[0.98] transition-transform flex items-center justify-center mt-6"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Tạo mục tiêu'
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
