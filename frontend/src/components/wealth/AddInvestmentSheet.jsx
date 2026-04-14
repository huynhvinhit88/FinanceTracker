import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { formatCurrency } from '../../utils/format';

export function AddInvestmentSheet({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  
  const [type, setType] = useState('gold');
  const [symbol, setSymbol] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('1');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue: displayBuyRow, value: buyPrice, handleInputChange: handleBuyPriceChange, reset: resetBuyPrice, suffix } = useCurrencyInput('');
  const { displayValue: displayCurrentRow, value: currentPrice, handleInputChange: handleCurrentPriceChange, reset: resetCurrentPrice } = useCurrencyInput('');
  const { displayValue: displayLoanRow, value: loanAmount, handleInputChange: handleLoanAmountChange, reset: resetLoanAmount } = useCurrencyInput('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isRE = type === 'real_estate';
    
    if (!symbol.trim()) return setError(isRE ? 'Vui lòng nhập tên BĐS (VD: Nhà Quận 1)' : 'Vui lòng nhập mã TS (VD: SJC)');
    if (!isRE && (!quantity || parseFloat(quantity) <= 0)) return setError('Số lượng phải lớn hơn 0');
    
    const finalCurrentPrice = currentPrice > 0 ? currentPrice : buyPrice;
    if (finalCurrentPrice <= 0) return setError('Vui lòng nhập giá trị tài sản');
    
    setLoading(true);
    setError('');

    try {
      await db.investments.add({
        id: crypto.randomUUID(),
        type,
        symbol: symbol.trim().toUpperCase(),
        name: symbol.trim(), // Lưu vào cả trường name để đồng bộ schema
        quantity: isRE ? 1 : parseFloat(quantity),
        buy_price: buyPrice,
        current_price: finalCurrentPrice,
        loan_amount: isRE ? loanAmount : 0,
        purchase_date: purchaseDate
      });
      
      resetBuyPrice();
      resetCurrentPrice();
      resetLoanAmount();
      setSymbol('');
      setQuantity('1');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi thêm tài sản');
    } finally {
      setLoading(false);
    }
  };

  const isRE = type === 'real_estate';
  const principal = Math.max(0, (currentPrice || buyPrice || 0) - loanAmount);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={isRE ? "Thêm Bất động sản" : "Thêm tài sản đầu tư"}>
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className={isRE ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3"}>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{isRE ? 'Tên Bất động sản' : 'Mã tài sản'}</label>
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              placeholder={isRE ? "VD: Căn hộ Vinhomes" : "SJC, BTC..."}
              className="w-full bg-gray-50 border border-transparent focus:border-purple-500 rounded-xl px-4 py-3 outline-none uppercase font-semibold"
            />
          </div>
          <div>
             <label className="block text-sm font-semibold text-gray-700 mb-2">{isRE ? 'Ngày mua' : 'Ngày mua'}</label>
             <input
               type="date"
               value={purchaseDate}
               onChange={e => setPurchaseDate(e.target.value)}
               className="w-full bg-gray-50 border border-transparent focus:border-purple-500 rounded-xl px-4 py-3 outline-none font-medium"
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
                placeholder="VD: 0.5"
                className="w-full bg-gray-50 border border-transparent focus:border-purple-500 rounded-xl px-4 py-3 outline-none font-medium"
              />
            </div>
          )}
        </div>

        {isRE ? (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Giá vốn / Vốn tự có ban đầu</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayBuyRow}
                  onChange={handleBuyPriceChange}
                  placeholder="Nhập giá lúc mua"
                  className="w-full bg-gray-50 text-purple-600 text-xl font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                  <span className="text-xl font-bold text-gray-400">{suffix}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tổng giá trị hiện tại</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayCurrentRow}
                  onChange={handleCurrentPriceChange}
                  placeholder="Nhập giá thị trường"
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
                 <span className="text-sm font-bold text-emerald-700">Vốn gốc / Tài sản ròng</span>
                 <span className="text-lg font-black text-emerald-600">{formatCurrency(principal)} ₫</span>
               </div>
               <p className="text-[10px] text-emerald-500 font-medium mt-1">(= Tổng giá trị - Nợ vay)</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Giá vốn Mua (1 Đơn vị)</label>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Giá thị trường hiện tại (1 Đơn vị)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayCurrentRow}
                  onChange={handleCurrentPriceChange}
                  placeholder="Bỏ trống = Lấy giá mua"
                  className="w-full bg-gray-50 text-gray-900 text-xl font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                  <span className="text-xl font-bold text-gray-400">{suffix}</span>
                </div>
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 text-white font-semibold rounded-2xl shadow-lg mt-4 active:scale-95 transition-transform flex justify-center ${isRE ? 'bg-indigo-600 shadow-indigo-100' : 'bg-purple-600 shadow-purple-100'}`}
        >
          {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Lưu tài sản'}
        </button>
      </form>
    </BottomSheet>
  );
}
