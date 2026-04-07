import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';

const DEFAULT_CATEGORIES = [
  { name: 'Ăn uống', type: 'expense', icon: '🍔', color_hex: '#EF4444' },
  { name: 'Di chuyển', type: 'expense', icon: '🚗', color_hex: '#3B82F6' },
  { name: 'Mua sắm', type: 'expense', icon: '🛍️', color_hex: '#ec4899' },
  { name: 'Hóa đơn', type: 'expense', icon: '🧾', color_hex: '#8B5CF6' },
  { name: 'Lương', type: 'income', icon: '💰', color_hex: '#10B981' },
  { name: 'Thưởng', type: 'income', icon: '🎁', color_hex: '#F59E0B' },
  { name: 'Khác', type: 'transfer', icon: '🔄', color_hex: '#6B7280' },
];

export function AddTransactionSheet({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  
  const [type, setType] = useState('expense'); // expense, income, transfer
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState(''); // for transfer only
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: rawAmount, handleInputChange, reset: resetAmount } = useCurrencyInput('');

  useEffect(() => {
    if (isOpen) {
      fetchDependencies();
    }
  }, [isOpen, user]);

  const fetchDependencies = async () => {
    if (!user) return;
    try {
      // 1. Fetch accounts
      const { data: accData, error: accErr } = await supabase
        .from('accounts')
        .select('*')
        .order('name');
      if (accErr) throw accErr;
      setAccounts(accData || []);
      
      // Auto-select first account if possible
      if (accData?.length > 0) {
        setAccountId(accData[0].id);
        if (accData.length > 1) setToAccountId(accData[1].id);
      }

      // 2. Fetch categories
      const { data: catData, error: catErr } = await supabase
        .from('categories')
        .select('*');
      if (catErr) throw catErr;
      
      let localCats = catData || [];
      
      // Auto-seed default categories if empty
      if (localCats.length === 0) {
        const seedCats = DEFAULT_CATEGORIES.map(c => ({
          ...c,
          user_id: user.id,
          is_default: true
        }));
        
        const { data: newCats, error: insertErr } = await supabase
          .from('categories')
          .insert(seedCats)
          .select();
          
        if (!insertErr && newCats) {
          localCats = newCats;
        }
      }
      
      setCategories(localCats);
      // Auto-select category based on active type
      const relevantCats = localCats.filter(c => c.type === type);
      if (relevantCats.length > 0) setCategoryId(relevantCats[0].id);

    } catch (err) {
      console.error(err);
      setError('Lỗi khi lấy dữ liệu: ' + err.message);
    }
  };

  // Re-evaluate category selection when type changes
  useEffect(() => {
    const relevantCats = categories.filter(c => c.type === type);
    if (relevantCats.length > 0) {
      // Don't overwrite if the user just switched tabs and the selected one is still valid? No, valid type check:
      const isValid = relevantCats.some(c => c.id === categoryId);
      if (!isValid) setCategoryId(relevantCats[0].id);
    } else {
      setCategoryId('');
    }
  }, [type, categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rawAmount <= 0) {
      setError('Số tiền phải lớn hơn 0');
      return;
    }
    if (!accountId) {
      setError('Vui lòng chọn tài khoản nguồn');
      return;
    }
    if (type === 'transfer' && (!toAccountId || accountId === toAccountId)) {
      setError('Tài khoản nhận không hợp lệ (trùng với nguồn)');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const payload = {
        user_id: user.id,
        account_id: accountId,
        category_id: type !== 'transfer' ? categoryId : null,
        to_account_id: type === 'transfer' ? toAccountId : null,
        amount: rawAmount,
        type: type,
        date: new Date(date).toISOString(),
        note: note.trim()
      };

      const { error: insertError } = await supabase
        .from('transactions')
        .insert([payload]);

      if (insertError) throw insertError;
      
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi lưu giao dịch');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    resetAmount();
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('expense');
  };

  const activeCategories = categories.filter(c => c.type === type);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Thêm giao dịch mới">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Type selector */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {[
            { id: 'expense', name: 'Khoản chi' },
            { id: 'income', name: 'Khoản thu' },
            { id: 'transfer', name: 'Chuyển tiền' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                type === t.id 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền</label>
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
              <span className="text-xl font-bold text-gray-400">.000</span>
              <span className="text-xl font-bold text-gray-400">₫</span>
            </div>
          </div>
        </div>

        {/* Accounts */}
        <div className={type === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Từ tài khoản</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
              ))}
            </select>
          </div>
          
          {type === 'transfer' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Đến tài khoản</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Categories (Not for Transfers) */}
        {type !== 'transfer' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Danh mục</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
            >
              {activeCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
            {activeCategories.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Không có danh mục nào cho loại này!</p>
            )}
          </div>
        )}

        {/* Date and Note */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày thực hiện</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú (Tùy chọn)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Ăn lẩu..."
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 mt-4 bg-gray-900 text-white font-semibold rounded-2xl shadow-lg shadow-gray-200 active:scale-[0.98] transition-transform flex items-center justify-center"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Lưu giao dịch'
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
