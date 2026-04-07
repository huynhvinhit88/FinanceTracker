import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Trash2, CheckCircle2 } from 'lucide-react';

export function EditSavingsSheet({ isOpen, onClose, savings, onSuccess }) {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [status, setStatus] = useState('active');
  
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: principalAmount, handleInputChange, setExternalValue } = useCurrencyInput('');

  useEffect(() => {
    if (isOpen && savings) {
      setName(savings.name);
      setExternalValue(savings.principal_amount);
      setInterestRate(savings.interest_rate.toString());
      setTermMonths(savings.term_months.toString());
      setStatus(savings.status);
      setError('');
    }
  }, [isOpen, savings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vui lòng nhập tên sổ');
    if (principalAmount <= 0) return setError('Số tiền gửi phải lớn hơn 0');
    if (!interestRate || parseFloat(interestRate) < 0) return setError('Lãi suất không hợp lệ');
    if (!termMonths || parseInt(termMonths) <= 0) return setError('Kỳ hạn phải lớn hơn 0 tháng');
    
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('savings')
        .update({
          name: name.trim(),
          principal_amount: principalAmount,
          interest_rate: parseFloat(interestRate),
          term_months: parseInt(termMonths),
          status: status
        })
        .eq('id', savings.id);

      if (updateError) throw updateError;
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật sổ tiết kiệm');
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!window.confirm('Bạn muốn tất toán sổ tiết kiệm này? Trạng thái sẽ chuyển sang "Đã tất toán".')) return;
    
    setSettleLoading(true);
    try {
      const { error: settleError } = await supabase
        .from('savings')
        .update({ status: 'settled' })
        .eq('id', savings.id);

      if (settleError) throw settleError;
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi tất toán');
    } finally {
      setSettleLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá sổ tiết kiệm này? Dữ liệu sẽ mất vĩnh viễn.')) return;
    
    setDeleteLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('savings')
        .delete()
        .eq('id', savings.id);

      if (deleteError) throw deleteError;
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi xoá sổ');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!savings) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Sửa sổ tiết kiệm">
      <form onSubmit={handleSubmit} className="space-y-5 pb-6">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tên sổ tiết kiệm</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
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
              className="w-full bg-gray-50 text-emerald-600 text-2xl font-bold py-3 pr-24 pl-4 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-400">.000</span>
              <span className="text-xl font-bold text-gray-400">₫</span>
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
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Kỳ hạn (Tháng)</label>
            <input
              type="number"
              value={termMonths}
              onChange={e => setTermMonths(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-2xl">
          <label className="block text-sm font-semibold text-gray-700">Trạng thái:</label>
          <select 
            value={status} 
            onChange={e => setStatus(e.target.value)}
            className="bg-transparent font-bold text-gray-900 outline-none"
          >
            <option value="active">Đang hoạt động</option>
            <option value="settled">Đã tất toán</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading || loading || settleLoading}
            className="py-3 bg-gray-100 text-red-600 font-bold rounded-2xl active:scale-95 transition-transform flex flex-col items-center justify-center text-[10px] space-y-1"
          >
            {deleteLoading ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <><Trash2 size={20} /><span>Xoá</span></>}
          </button>
          
          {status === 'active' ? (
            <button
              type="button"
              onClick={handleSettle}
              disabled={settleLoading || loading || deleteLoading}
              className="py-3 bg-emerald-100 text-emerald-700 font-bold rounded-2xl active:scale-95 transition-transform flex flex-col items-center justify-center text-[10px] space-y-1"
            >
              {settleLoading ? <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" /> : <><CheckCircle2 size={20} /><span>Tất toán</span></>}
            </button>
          ) : (
            <div className="py-3 bg-gray-200 text-gray-400 font-bold rounded-2xl flex flex-col items-center justify-center text-[10px] space-y-1 opacity-50 cursor-not-allowed">
              <CheckCircle2 size={20} /><span>Tất toán</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || deleteLoading || settleLoading}
            className="col-span-1 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-transform flex items-center justify-center"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Lưu'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
