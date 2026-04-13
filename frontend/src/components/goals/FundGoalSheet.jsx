import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';

export function FundGoalSheet({ isOpen, onClose, onSuccess, goal }) {
  const { user } = useAuth();
  
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: rawAmount, handleInputChange, reset: resetAmount, suffix } = useCurrencyInput('');

  useEffect(() => {
    if (isOpen && user) {
      fetchAccounts();
    }
  }, [isOpen, user]);

  const fetchAccounts = async () => {
    try {
      const data = await db.accounts.orderBy('name').toArray();
      setAccounts(data);
      if (data && data.length > 0) setAccountId(data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!goal) return;
    
    if (rawAmount <= 0) {
      setError('Số tiền góp phải lớn hơn 0');
      return;
    }
    if (!accountId) {
      setError('Vui lòng chọn ví nguồn để rút tiền!');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // 1. Create Expense Transaction
      await db.transactions.add({
        id: crypto.randomUUID(),
        account_id: accountId,
        amount: rawAmount,
        type: 'expense',
        date: new Date().toISOString(),
        note: `Góp quỹ: ${goal.name}`
      });

      // 2. Update Goal Current Amount
      const newAmount = goal.current_amount + rawAmount;
      await db.goals.update(goal.id, { current_amount: newAmount });
      
      resetAmount();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi xử lý giao dịch góp tiền');
    } finally {
      setLoading(false);
    }
  };

  if (!goal) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Góp tiền: ${goal.name}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="bg-green-50 text-green-800 p-4 rounded-xl text-sm mb-4 border border-green-100">
           <p className="font-semibold mb-1">Mục tiêu: {goal.name}</p>
           <p className="opacity-90">Tiết kiệm là một hành trình tuyệt vời. Cố lên nhé!</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền muốn nuôi heo</label>
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
          <label className="block text-sm font-semibold text-gray-700 mb-2">Rút tiền từ ví nào?</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full bg-gray-50 border border-transparent focus:border-green-500 rounded-xl px-4 py-3 outline-none"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} (Số dư: {acc.balance.toLocaleString('vi-VN')}đ)</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">Hệ thống sẽ tự động tạo một giao dịch Chi Tiêu trừ thẳng vào ví này như thực tế.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-green-600 text-white font-semibold rounded-2xl shadow-lg shadow-green-200 active:scale-[0.98] transition-transform flex items-center justify-center mt-6"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Hoàn tất góp tiền'
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
