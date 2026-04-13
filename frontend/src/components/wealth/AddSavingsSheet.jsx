import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';

export function AddSavingsSheet({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: principalAmount, handleInputChange, reset: resetPrincipal, suffix } = useCurrencyInput('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vui lòng nhập tên sổ');
    if (principalAmount <= 0) return setError('Số tiền gửi phải lớn hơn 0');
    if (!interestRate || parseFloat(interestRate) < 0) return setError('Lãi suất không hợp lệ');
    if (!termMonths || parseInt(termMonths) <= 0) return setError('Kỳ hạn phải lớn hơn 0 tháng');
    
    setLoading(true);
    setError('');

    try {
      await db.savings.add({
        id: crypto.randomUUID(),
        name: name.trim(),
        principal_amount: principalAmount,
        interest_rate: parseFloat(interestRate),
        term_months: parseInt(termMonths),
        status: 'active'
      });
      
      resetPrincipal();
      setName('');
      setInterestRate('');
      setTermMonths('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi thêm sổ tiết kiệm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Tạo sổ tiết kiệm">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tên sổ tiết kiệm</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ví dụ: Gửi góp VCB..."
            className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền gốc (VND)</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              className="w-full bg-gray-50 text-blue-600 text-2xl font-bold py-3 pr-24 pl-4 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-400">{suffix}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Lãi suất (%/năm)</label>
            <input
              type="number"
              step="0.01"
              value={interestRate}
              onChange={e => setInterestRate(e.target.value)}
              placeholder="VD: 5.5"
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Kỳ hạn (Tháng)</label>
            <input
              type="number"
              value={termMonths}
              onChange={e => setTermMonths(e.target.value)}
              placeholder="VD: 6"
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 mt-4 active:scale-95 transition-transform flex justify-center"
        >
          {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Tạo sổ'}
        </button>
      </form>
    </BottomSheet>
  );
}
