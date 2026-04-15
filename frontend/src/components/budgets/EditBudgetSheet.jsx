import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Trash2 } from 'lucide-react';

export function EditBudgetSheet({ isOpen, onClose, budget, onSuccess, viewMonth }) {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);

  const { displayValue, value: rawAmount, handleInputChange, setExternalValue, suffix } = useCurrencyInput('', { useShortcut: true });

  useEffect(() => {
    if (isOpen && budget) {
      setExternalValue(budget.amount);
      setApplyToAll(!budget.month);
      setError('');
    }
  }, [isOpen, budget]);

  const isIncome = budget?.category?.type === 'income';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rawAmount <= 0) {
      setError('Số tiền phải lớn hơn 0');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      if (budget.month) {
        await db.budgets.update(budget.id, { amount: rawAmount });
      } else {
        if (applyToAll) {
          await db.budgets.update(budget.id, { amount: rawAmount });
        } else {
          const existing = await db.budgets
            .filter(b => b.category_id === budget.category_id && b.month === viewMonth)
            .first();
            
          if (existing) {
            await db.budgets.update(existing.id, { amount: rawAmount });
          } else {
            await db.budgets.add({
              id: crypto.randomUUID(),
              category_id: budget.category_id,
              amount: rawAmount,
              month: viewMonth
            });
          }
        }
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá ngân sách cho danh mục này?')) return;
    
    setDeleteLoading(true);
    setError('');

    try {
      await db.budgets.delete(budget.id);
      
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
          <div className="p-3 bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 rounded-xl text-sm font-medium border border-red-100 dark:border-rose-900/30">
            {error}
          </div>
        )}

        <div className="flex items-center space-x-3 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-4 border border-transparent dark:border-white/5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 text-2xl shadow-sm`}>
            {budget.category?.icon}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-gray-900 dark:text-slate-100">{budget.category?.name}</h4>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${budget.month ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                {budget.month ? `Tháng ${budget.month.split('-').reverse().join('/')}` : 'Mặc định'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-500">
              {isIncome ? 'Đang thiết lập mục tiêu thu' : 'Đang thiết lập hạn mức chi'}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            {isIncome ? 'Mục tiêu thu về 1 tháng mới' : 'Hạn mức chi tiêu 1 tháng mới'}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              placeholder="0"
              className={`w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-3xl font-bold py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 transition-all outline-none ${
                isIncome ? 'focus:ring-emerald-500' : 'focus:ring-blue-500'
              }`}
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-400 dark:text-slate-600">{suffix}</span>
            </div>
          </div>
          
          {!budget.month && (
            <div className="mt-4 flex items-center space-x-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30">
              <input
                id="applyToAll"
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="applyToAll" className="text-xs font-bold text-indigo-700 dark:text-indigo-400 leading-tight">
                Áp dụng cho tất cả các tháng (Cập nhật Mặc định)
                <p className="font-normal text-indigo-500/80 dark:text-indigo-500/60 mt-0.5">Nếu tắt, hệ thống sẽ tạo kế hoạch riêng cho {viewMonth.split('-').reverse().join('/')}</p>
              </label>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading || loading}
            className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-red-600 dark:text-rose-400 font-bold rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center space-x-2 border border-transparent dark:border-white/5"
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
