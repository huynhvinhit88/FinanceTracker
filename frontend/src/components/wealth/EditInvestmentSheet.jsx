import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

export function EditInvestmentSheet({ isOpen, onClose, investment, onSuccess }) {
  const { user } = useAuth();
  
  const [type, setType] = useState('gold');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('1');
  
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue: displayBuyRow, value: buyPrice, handleInputChange: handleBuyPriceChange, setExternalValue: setBuyPrice, suffix } = useCurrencyInput('');
  const { displayValue: displayCurrentRow, value: currentPrice, handleInputChange: handleCurrentPriceChange, setExternalValue: setCurrentPrice } = useCurrencyInput('');
  const { displayValue: displayLoanRow, value: loanAmount, handleInputChange: handleLoanAmountChange, setExternalValue: setLoanAmount } = useCurrencyInput('');

  useEffect(() => {
    if (isOpen && investment) {
      setType(investment.type);
      setSymbol(investment.symbol);
      setQuantity(investment.quantity.toString());
      setBuyPrice(investment.buy_price);
      setCurrentPrice(investment.current_price);
      setLoanAmount(investment.loan_amount || 0);
      setError('');
    }
  }, [isOpen, investment]);

  const isRE = type === 'real_estate';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!symbol.trim()) return setError(isRE ? 'Vui lòng nhập tên BĐS' : 'Vui lòng nhập mã TS (VD: SJC)');
    if (!isRE && (!quantity || parseFloat(quantity) <= 0)) return setError('Số lượng phải lớn hơn 0');
    if (currentPrice <= 0) return setError('Giá trị hiện tại phải lớn hơn 0');
    
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('investments')
        .update({
          type,
          symbol: symbol.trim().toUpperCase(),
          quantity: isRE ? 1 : parseFloat(quantity),
          buy_price: buyPrice,
          current_price: currentPrice,
          loan_amount: isRE ? loanAmount : 0
        })
        .eq('id', investment.id);

      if (updateError) throw updateError;
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật tài sản');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá khoản đầu tư này? Dữ liệu sẽ mất vĩnh viễn.')) return;
    
    setDeleteLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('investments')
        .delete()
        .eq('id', investment.id);

      if (deleteError) throw deleteError;
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi xoá khoản đầu tư');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!investment) return null;

  const principal = Math.max(0, currentPrice - loanAmount);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={isRE ? "Sửa Bất động sản" : "Sửa tài sản đầu tư"}>
      <form onSubmit={handleSubmit} className="space-y-4 pb-6">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { id: 'gold', name: 'Vàng' },
            { id: 'crypto', name: 'Coin' },
            { id: 'stock', name: 'CP' },
            { id: 'real_estate', name: 'BĐS' },
            { id: 'other', name: 'Khác' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setType(t.id);
                if (t.id === 'real_estate') setQuantity('1');
              }}
              className={`flex-1 min-w-[60px] py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                type === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className={isRE ? "block" : "grid grid-cols-2 gap-3"}>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{isRE ? 'Tên Bất động sản' : 'Mã tài sản'}</label>
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-purple-500 rounded-xl px-4 py-3 outline-none uppercase font-semibold"
            />
          </div>
          {!isRE && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Số lượng</label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-purple-500 rounded-xl px-4 py-3 outline-none font-medium"
              />
            </div>
          )}
        </div>

        {isRE ? (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tổng giá trị hiện tại</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayCurrentRow}
                  onChange={handleCurrentPriceChange}
                  className="w-full bg-gray-50 text-indigo-600 text-xl font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                  <span className="text-xl font-bold text-gray-400">{suffix}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền vay hiện tại</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayLoanRow}
                  onChange={handleLoanAmountChange}
                  className="w-full bg-gray-50 text-red-500 text-xl font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                  <span className="text-xl font-bold text-gray-400">{suffix}</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
               <div className="flex justify-between items-center">
                 <span className="text-sm font-bold text-emerald-700">Vốn gốc hiện tại (Equity)</span>
                 <span className="text-lg font-black text-emerald-600">{formatCurrency(principal)} ₫</span>
               </div>
               <p className="text-[10px] text-emerald-500 font-medium mt-1">(= Tổng giá trị - Nợ vay)</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Giá vốn (1 Đơn vị)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayBuyRow}
                  onChange={handleBuyPriceChange}
                  className="w-full bg-gray-50 text-purple-600 text-xl font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                  <span className="text-xl font-bold text-gray-400">{suffix}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Giá thị trường (1 Đơn vị)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayCurrentRow}
                  onChange={handleCurrentPriceChange}
                  className="w-full bg-gray-50 text-gray-900 border border-gray-100 text-xl font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                  <span className="text-xl font-bold text-gray-400">{suffix}</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-3 pt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading || loading}
            className="flex flex-col items-center justify-center py-3 bg-gray-100 text-red-600 font-bold rounded-2xl active:scale-95 transition-transform text-[10px] space-y-1 shadow-sm"
          >
            {deleteLoading ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <><Trash2 size={20} /><span>Xoá</span></>}
          </button>
          
          <button
            type="submit"
            disabled={loading || deleteLoading}
            className={`col-span-2 py-4 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center ${isRE ? 'bg-indigo-600 shadow-indigo-100' : 'bg-purple-600 shadow-purple-100'}`}
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Cập nhật tài sản'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
