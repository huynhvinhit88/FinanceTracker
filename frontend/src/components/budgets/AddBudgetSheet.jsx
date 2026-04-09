import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';

export function AddBudgetSheet({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  
  const [planType, setPlanType] = useState('expense'); // 'expense' or 'income'
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [applyType, setApplyType] = useState('default'); // 'default' or 'monthly'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: rawAmount, handleInputChange, reset: resetAmount, suffix } = useCurrencyInput('', { useShortcut: true });

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    } else {
      resetForm();
    }
  }, [isOpen, user, planType]);

  const fetchCategories = async () => {
    if (!user) return;
    try {
      const { data, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('type', planType)
        .order('name');
        
      if (catError) throw catError;
      setCategories(data || []);
      if (data && data.length > 0) {
        setCategoryId(data[0].id);
      } else {
        setCategoryId('');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải danh mục');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rawAmount <= 0) {
      setError('Hạn mức ngân sách phải lớn hơn 0');
      return;
    }
    if (!categoryId) {
      setError('Vui lòng chọn danh mục');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const payload = {
        user_id: user.id,
        category_id: categoryId,
        amount: rawAmount,
        month: applyType === 'monthly' ? selectedMonth : null
      };

      // Upsert: Using the new unique logic (cat_id, month)
      const { error: upsertError } = await supabase
        .from('budgets')
        .upsert(payload, { onConflict: 'user_id, category_id, month' });

      if (upsertError) throw upsertError;
      
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi lưu ngân sách');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    resetAmount();
    if (categories.length > 0) setCategoryId(categories[0].id);
    setApplyType('default');
  };

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title={planType === 'expense' ? 'Thiết lập dự chi' : 'Thiết lập dự thu'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setPlanType('expense')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              planType === 'expense' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Dự chi
          </button>
          <button
            type="button"
            onClick={() => setPlanType('income')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              planType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Dự thu
          </button>
        </div>

        <div className="space-y-4 pt-1">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {planType === 'expense' ? 'Hạn mức hàng tháng' : 'Mục tiêu thu về hàng tháng'}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={handleInputChange}
                placeholder="0"
                className={`w-full bg-gray-50 text-gray-900 text-3xl font-bold py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 transition-all outline-none ${
                  planType === 'expense' ? 'focus:ring-blue-500' : 'focus:ring-emerald-500'
                }`}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                <span className="text-xl font-bold text-gray-400">{suffix}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
               <label className="block text-xs font-semibold text-gray-500 ml-1">Áp dụng cho</label>
               <select 
                 value={applyType} 
                 onChange={(e) => setApplyType(e.target.value)}
                 className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold"
               >
                 <option value="default">Mặc định (Tất cả các tháng)</option>
                 <option value="monthly">Tháng cụ thể</option>
               </select>
             </div>
             {applyType === 'monthly' && (
               <div className="space-y-1">
                 <label className="block text-xs font-semibold text-gray-500 ml-1">Chọn tháng</label>
                 <input 
                   type="month" 
                   value={selectedMonth} 
                   onChange={(e) => setSelectedMonth(e.target.value)}
                   className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none"
                 />
               </div>
             )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Hạng mục</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
          >
            {categories.length === 0 && <option value="">Không có danh mục nào</option>}
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-2 px-1">
            {applyType === 'default' 
              ? 'Kế hoạch mặc định sẽ được áp dụng cho mọi tháng nếu tháng đó chưa có kế hoạch riêng.' 
              : `Kế hoạch này sẽ chỉ áp dụng duy nhất cho tháng ${selectedMonth.split('-').reverse().join('/')}.`}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !categoryId}
          className={`w-full py-4 text-white font-semibold rounded-2xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center mt-6 ${
            planType === 'expense' ? 'bg-blue-600 shadow-blue-200' : 'bg-emerald-600 shadow-emerald-200'
          } ${(!categoryId) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Lưu kế hoạch'
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
