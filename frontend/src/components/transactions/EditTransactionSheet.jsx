import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Trash2 } from 'lucide-react';

export function EditTransactionSheet({ isOpen, onClose, onSuccess, transaction }) {
  const { user } = useAuth();
  
  const [type, setType] = useState('expense');
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState(''); 
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: rawAmount, handleInputChange, setExternalValue, suffix } = useCurrencyInput('', { useShortcut: true });

  useEffect(() => {
    if (isOpen && transaction) {
      setType(transaction.type);
      setExternalValue(transaction.amount);
      setAccountId(transaction.account_id || '');
      setToAccountId(transaction.to_account_id || '');
      setCategoryId(transaction.category_id || '');
      setNote(transaction.note || '');
      
      // format date to YYYY-MM-DD
      const d = new Date(transaction.date);
      setDate(d.toISOString().split('T')[0]);
      
      fetchDependencies();
    }
  }, [isOpen, transaction]);

  const fetchDependencies = async () => {
    if (!user) return;
    try {
      const { data: accData } = await supabase.from('accounts').select('*').order('name');
      setAccounts(accData || []);
      
      const { data: catData } = await supabase.from('categories').select('*');
      setCategories(catData || []);
    } catch (err) {
      console.error(err);
    }
  };

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
      setError('Tài khoản nhận không hợp lệ');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const payload = {
        account_id: accountId,
        category_id: type !== 'transfer' ? categoryId : null,
        to_account_id: type === 'transfer' ? toAccountId : null,
        amount: rawAmount,
        type: type,
        date: new Date(date).toISOString(),
        note: note.trim()
      };

      const { error: updateError } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', transaction.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật giao dịch');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm("Bạn muốn xóa giao dịch này? Số dư ví sẽ hoàn trả tương ứng.");
    if (!confirmDelete) return;

    setIsDeleting(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi xóa giao dịch');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCategories = categories.filter(c => c.type === type);

  if (!transaction) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Sửa giao dịch">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {[
            { id: 'expense', name: 'Khoản chi' },
            { id: 'income', name: 'Khoản thu' },
            { id: 'transfer', name: 'Chuyển tiền' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setType(t.id);
                const relevantCats = categories.filter(c => c.type === t.id);
                setCategoryId(relevantCats.length > 0 ? relevantCats[0].id : '');
              }}
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              className="w-full bg-gray-50 text-green-600 text-3xl font-bold py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 focus:ring-green-500 transition-all outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-400">{suffix}</span>
            </div>
          </div>
        </div>

        <div className={type === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Từ tài khoản</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none truncate"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
          
          {type === 'transfer' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Đến tài khoản</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none truncate"
              >
                <option value="">Chọn...</option>
                {accounts.filter(a => a.id !== accountId).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

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
          </div>
        )}

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
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
            />
          </div>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || loading}
            className="px-4 py-4 bg-red-50 text-red-600 font-semibold rounded-2xl active:scale-[0.98] transition-all border border-red-100 flex-shrink-0"
          >
            {isDeleting ? <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={20} />}
          </button>
          
          <button
            type="submit"
            disabled={loading || isDeleting}
            className="flex-1 py-4 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Lưu lại'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
