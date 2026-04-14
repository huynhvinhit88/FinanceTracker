import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Wallet, BriefcaseBusiness, PiggyBank, CreditCard, HandCoins, Trash2 } from 'lucide-react';

const ACCOUNT_TYPES = [
  { id: 'Ví/Tiền mặt', label: 'Tiền mặt', icon: Wallet, sub_type: 'payment', color: '#10B981' },
  { id: 'Ngân hàng', label: 'Ngân hàng', icon: BriefcaseBusiness, sub_type: 'payment', color: '#3B82F6' },
  { id: 'Ví điện tử', label: 'Ví điện tử', icon: Wallet, sub_type: 'payment', color: '#8B5CF6' },
  { id: 'Tiết kiệm', label: 'Tiết kiệm', icon: PiggyBank, sub_type: 'savings', color: '#F59E0B' },
  { id: 'Thẻ tín dụng', label: 'Thẻ tín dụng', icon: CreditCard, sub_type: 'debt', color: '#EF4444' },
  { id: 'Khoản nợ', label: 'Khoản nợ', icon: HandCoins, sub_type: 'debt', color: '#F97316' },
  { id: 'Phải thu', label: 'Phải thu', icon: HandCoins, sub_type: 'receivable', color: '#14B8A6' },
];

export function EditAccountSheet({ isOpen, onClose, onSuccess, account }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState(ACCOUNT_TYPES[0]);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  
  const { displayValue, value: rawBalance, handleInputChange, setExternalValue, suffix } = useCurrencyInput('');

  useEffect(() => {
    if (isOpen && account) {
      setName(account.name);
      
      let matchType;
      if (account.sub_type === 'savings') {
        matchType = ACCOUNT_TYPES.find(t => t.id === 'Tiết kiệm');
      } else {
        matchType = ACCOUNT_TYPES.find(t => t.id === account.type && t.sub_type === account.sub_type) 
                 || ACCOUNT_TYPES.find(t => t.id === account.type) 
                 || ACCOUNT_TYPES[0];
      }
      setSelectedType(matchType);
      
      setExternalValue(account.balance);
      setError('');
    }
  }, [isOpen, account]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên tài khoản');
      return;
    }
    
    setLoading(true);
    setError('');

    let dbType = selectedType.id;
    if (dbType === 'Tiết kiệm') dbType = 'Ngân hàng';

    try {
      await db.accounts.update(account.id, {
        name: name.trim(),
        type: dbType,
        sub_type: selectedType.sub_type,
        balance: rawBalance, 
        color_hex: selectedType.color
      });
      
      onSuccess();
      onClose();
      
    } catch (err) {
      console.error(err);
      setError(err.message || 'Đã xảy ra lỗi khi cập nhật tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm("Bạn có chắc chắn muốn xóa tài khoản này? Mọi giao dịch liên quan có thể bị ảnh hưởng.");
    if (!confirmDelete) return;

    setIsDeleting(true);
    setError('');

    try {
      await db.accounts.delete(account.id);

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Đã xảy ra lỗi khi xóa tài khoản');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!account) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Sửa tài khoản">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số dư định mức</label>
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
                  <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                    {type.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || loading}
            className="px-4 py-4 bg-red-50 text-red-600 font-semibold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center border border-red-100 shrink-0"
          >
            {isDeleting ? (
               <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={20} />
            )}
          </button>
          
          <button
            type="submit"
            disabled={loading || isDeleting}
            className="flex-1 py-4 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center"
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
