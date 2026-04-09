import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Trash2 } from 'lucide-react';

export function EditBudgetSheet({ isOpen, onClose, budget, onSuccess }) {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: rawAmount, handleInputChange, setExternalValue, suffix } = useCurrencyInput('', { useShortcut: true });

  useEffect(() => {
    if (isOpen && budget) {
      setExternalValue(budget.amount);
      setError('');
    }
  }, [isOpen, budget]);

  const isIncome = budget?.category?.type === 'income';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rawAmount <= 0) {
      setError('Hạn mức ngân sách phải lớn hơn 0');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('budgets')
        .update({ amount: rawAmount })
        .eq('id', budget.id);

      if (updateError) throw updateError;
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật ngân sách');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá ngân sách cho danh mục này?')) return;
    
    setDeleteLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budget.id);

      if (deleteError) throw deleteError;
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi xoá ngân sách');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!budget) return null;

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isIncome ? `Sửa kế hoạch thu: ${budget.category?.name}` : `Sửa ngân sách chi: ${budget.category?.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6 pb-6">
        
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-2xl mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white text-2xl shadow-sm`}>
            {budget.category?.icon}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-gray-900">{budget.category?.name}</h4>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${budget.month ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                {budget.month ? `Tháng ${budget.month.split('-').reverse().join('/')}` : 'Mặc định'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {isIncome ? 'Đang thiết lập mục tiêu thu' : 'Đ đang thiết lập hạn mức chi'}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {isIncome ? 'Mục tiêu thu về 1 tháng mới' : 'Hạn mức chi tiêu 1 tháng mới'}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              placeholder="0"
              className={`w-full bg-gray-50 text-gray-900 text-3xl font-bold py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 transition-all outline-none ${
                isIncome ? 'focus:ring-emerald-500' : 'focus:ring-blue-500'
              }`}
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-400">{suffix}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading || loading}
            className="flex-1 py-4 bg-gray-100 text-red-600 font-bold rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center space-x-2"
          >
            {deleteLoading ? (
              <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 size={18} />
                <span>Xoá</span>
              </>
            )}
          </button>
          
          <button
            type="submit"
            disabled={loading || deleteLoading}
            className={`flex-1 py-4 text-white font-bold rounded-2xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center ${
              isIncome ? 'bg-emerald-600 shadow-emerald-200' : 'bg-blue-600 shadow-blue-200'
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Cập nhật'
            )}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
