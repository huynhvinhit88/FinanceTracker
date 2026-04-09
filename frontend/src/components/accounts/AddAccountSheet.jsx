import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Wallet, BriefcaseBusiness, PiggyBank, CreditCard, DivideSquare as HandCoins } from 'lucide-react';

const ACCOUNT_TYPES = [
  { id: 'Ví/Tiền mặt', label: 'Tiền mặt', icon: Wallet, sub_type: 'payment', color: '#10B981' },
  { id: 'Ngân hàng', label: 'Ngân hàng', icon: BriefcaseBusiness, sub_type: 'payment', color: '#3B82F6' },
  { id: 'Ví điện tử', label: 'Ví điện tử', icon: Wallet, sub_type: 'payment', color: '#8B5CF6' },
  { id: 'Tiết kiệm', label: 'Tiết kiệm', icon: PiggyBank, sub_type: 'savings', color: '#F59E0B' }, // Note: We'll map 'Tiết kiệm' to 'Ngân hàng' with sub_type savings before inserting
  { id: 'Thẻ tín dụng', label: 'Thẻ tín dụng', icon: CreditCard, sub_type: 'debt', color: '#EF4444' },
  { id: 'Khoản nợ', label: 'Khoản nợ', icon: HandCoins, sub_type: 'debt', color: '#F97316' },
  { id: 'Phải thu', label: 'Phải thu', icon: HandCoins, sub_type: 'debt', color: '#14B8A6' },
];

export function AddAccountSheet({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState(ACCOUNT_TYPES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { displayValue, value: rawBalance, handleInputChange, reset: resetCurrency, suffix } = useCurrencyInput('');

  const resetForm = () => {
    setName('');
    setSelectedType(ACCOUNT_TYPES[0]);
    resetCurrency();
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên tài khoản');
      return;
    }
    
    setLoading(true);
    setError('');

    // Xử lý mapping type phù hợp database schema
    let dbType = selectedType.id;
    if (dbType === 'Tiết kiệm') dbType = 'Ngân hàng';

    try {
      const { error: insertError } = await supabase.from('accounts').insert([
        {
          user_id: user.id,
          name: name.trim(),
          type: dbType,
          sub_type: selectedType.sub_type,
          balance: rawBalance, 
          icon: 'Wallet', // Could be dynamic based on user selection in future
          color_hex: selectedType.color
        }
      ]);

      if (insertError) throw insertError;
      
      resetForm();
      onSuccess();
      onClose();
      
    } catch (err) {
      console.error(err);
      setError(err.message || 'Đã xảy ra lỗi khi thêm tài khoản');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Thêm tài khoản mới">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số dư ban đầu</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              placeholder="0"
              className="w-full bg-gray-50 text-gray-900 text-3xl font-bold py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-400">{suffix}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tên tài khoản</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Tiền mặt, Thẻ VCB..."
            className="w-full bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-4 py-3 outline-none transition-all"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Loại phân loại</label>
          <div className="grid grid-cols-2 gap-3">
            {ACCOUNT_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType.id === type.id;
              
              return (
                <div 
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={`flex items-center space-x-2 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 shadow-sm' 
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center`} style={{ backgroundColor: isSelected ? type.color : '#F3F4F6' }}>
                    <Icon size={16} color={isSelected ? 'white' : '#6B7280'} />
                  </div>
                  <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                    {type.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 mt-2 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Lưu tài khoản'
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
