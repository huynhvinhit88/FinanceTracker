import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Wallet, BriefcaseBusiness, PiggyBank, CreditCard, HandCoins, Trash2, Star } from 'lucide-react';

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
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  
  // allowNegative: cho phép nhập số dư âm (ví Nợ/thẻ tín dụng đang nợ → balance âm).
  const { displayValue, value: rawBalance, handleInputChange, setExternalValue, suffix } = useCurrencyInput('', { allowNegative: true });

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
      setIsDefault(!!account.is_default);
      setExternalValue(account.balance);
      setError('');
    }
  }, [isOpen, account]);

  const handleDefaultChange = async (checked) => {
    if (checked) {
      // Kiểm tra xem đã có tài khoản mặc định khác chưa
      const allAccounts = await db.accounts.toArray();
      const currentDefault = allAccounts.find(acc => acc.is_default && acc.id !== account.id);
      if (currentDefault) {
        const confirmed = window.confirm(
          `Tài khoản "${currentDefault.name}" đang được đặt làm tài khoản nguồn mặc định.\nBạn có muốn thay thế bằng tài khoản "${account.name}" không?`
        );
        if (!confirmed) return;
      }
    }
    setIsDefault(checked);
  };

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
      // Nếu đặt làm mặc định, xóa is_default của tất cả tài khoản khác trước
      if (isDefault) {
        const allAccounts = await db.accounts.toArray();
        for (const acc of allAccounts) {
          if (acc.is_default && acc.id !== account.id) {
            await db.accounts.update(acc.id, { is_default: false });
          }
        }
      }

      await db.accounts.update(account.id, {
        name: name.trim(),
        type: dbType,
        sub_type: selectedType.sub_type,
        balance: rawBalance, 
        color_hex: selectedType.color,
        is_default: isDefault,
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
          <div className="p-3 bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 rounded-xl text-sm font-medium border border-red-100 dark:border-rose-900/30">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Số dư định mức</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              placeholder="0"
              className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-3xl font-bold py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-indigo-500 transition-all outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-400">{suffix}</span>
            </div>
          </div>
          {selectedType.sub_type === 'debt' && (
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
              Đây là số dư thực: nhập <span className="font-semibold text-red-500 dark:text-rose-400">số âm</span> nếu đang nợ (vd <span className="font-mono">-500.000</span>).
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Tên tài khoản</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Tiền mặt, Thẻ VCB..."
            className="w-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-blue-500 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-xl px-4 py-3 outline-none transition-all"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Loại phân loại</label>
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
                      ? 'border-blue-500 dark:border-indigo-500 bg-blue-50 dark:bg-indigo-900/20 shadow-sm' 
                      : 'border-gray-200 dark:border-white/5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center`} style={{ backgroundColor: isSelected ? type.color : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#F3F4F6') }}>
                    <Icon size={16} color={isSelected ? 'white' : '#6B7280'} />
                  </div>
                  <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900 dark:text-indigo-100' : 'text-gray-700 dark:text-slate-400'}`}>
                    {type.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkbox đặt làm tài khoản mặc định */}
        <div
          onClick={() => handleDefaultChange(!isDefault)}
          className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none ${
            isDefault
              ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-700/50'
              : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              isDefault ? 'bg-amber-400 dark:bg-amber-500' : 'bg-gray-200 dark:bg-slate-700'
            }`}>
              <Star size={16} color="white" fill={isDefault ? 'white' : 'none'} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${
                isDefault ? 'text-amber-800 dark:text-amber-300' : 'text-gray-700 dark:text-slate-300'
              }`}>Đặt làm tài khoản nguồn mặc định</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {isDefault ? '⭐ Đang là tài khoản mặc định — tự động chọn khi thêm GD' : 'Tự động chọn khi thêm giao dịch mới'}
              </p>
            </div>
          </div>
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isDefault
              ? 'bg-amber-400 dark:bg-amber-500 border-amber-400 dark:border-amber-500'
              : 'border-gray-300 dark:border-slate-600'
          }`}>
            {isDefault && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || loading}
            className="px-4 py-4 bg-red-50 dark:bg-rose-900/10 text-red-600 dark:text-rose-400 font-semibold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center border border-red-100 dark:border-rose-900/30 shrink-0"
          >
            {isDeleting ? (
               <div className="w-5 h-5 border-2 border-red-600 dark:border-rose-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={20} />
            )}
          </button>
          
          <button
            type="submit"
            disabled={loading || isDeleting}
            className="flex-1 py-4 bg-blue-600 dark:bg-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none active:scale-[0.98] transition-transform flex items-center justify-center"
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
