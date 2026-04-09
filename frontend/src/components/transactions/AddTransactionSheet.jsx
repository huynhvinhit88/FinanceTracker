import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { useLoans } from '../../hooks/useLoans';
import { Landmark, Info, Calculator } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { calculateLoanSchedule } from '../../utils/loanCalculator';

const DEFAULT_CATEGORIES = [
  { name: 'Ăn uống', type: 'expense', icon: '🍔', color_hex: '#EF4444' },
  { name: 'Di chuyển', type: 'expense', icon: '🚗', color_hex: '#3B82F6' },
  { name: 'Mua sắm', type: 'expense', icon: '🛍️', color_hex: '#ec4899' },
  { name: 'Hóa đơn', type: 'expense', icon: '🧾', color_hex: '#8B5CF6' },
  { name: 'Trả nợ vay', type: 'expense', icon: '🏦', color_hex: '#EF4444' },
  { name: 'Lương', type: 'income', icon: '💰', color_hex: '#10B981' },
  { name: 'Thưởng', type: 'income', icon: '🎁', color_hex: '#F59E0B' },
  { name: 'Khác', type: 'transfer', icon: '🔄', color_hex: '#6B7280' },
];

export function AddTransactionSheet({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const { loans, fetchLoans, updateLoanBalance, suggestInterest } = useLoans();
  
  const [type, setType] = useState('expense'); // expense, income, transfer, repayment
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState(''); // for transfer only
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Loan Repayment State
  const [isLoanMode, setIsLoanMode] = useState(false);
  const [loanId, setLoanId] = useState('');
  const [repaymentType, setRepaymentType] = useState('periodic'); // periodic, payoff
  const { displayValue: principalDisplay, value: principalRaw, handleInputChange: handlePrincipalChange, reset: resetPrincipal, suffix: principalSuffix, setExternalValue: setExternalPrincipal } = useCurrencyInput(0, { useShortcut: false });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: rawAmount, handleInputChange, reset: resetAmount, suffix, setExternalValue } = useCurrencyInput(0, { useShortcut: type !== 'repayment' });

  useEffect(() => {
    if (isOpen) {
      fetchDependencies();
      fetchLoans();
    }
  }, [isOpen, user]);

  const fetchDependencies = async () => {
    if (!user) return;
    try {
      const { data: accData } = await supabase.from('accounts').select('*').order('name');
      setAccounts(accData || []);
      if (accData?.length > 0) setAccountId(accData[0].id);

      const { data: catData } = await supabase.from('categories').select('*');
      let localCats = catData || [];
      
      if (localCats.length === 0) {
        const seedCats = DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id, is_default: true }));
        const { data: newCats } = await supabase.from('categories').insert(seedCats).select();
        if (newCats) localCats = newCats;
      }
      
      setCategories(localCats);
      const relevantCats = localCats.filter(c => c.type === type);
      if (relevantCats.length > 0) setCategoryId(relevantCats[0].id);

    } catch (err) {
      console.error(err);
      setError('Lỗi khi lấy dữ liệu: ' + err.message);
    }
  };

  useEffect(() => {
    if (type === 'repayment') {
      setIsLoanMode(true);
      if (loans.length > 0 && !loanId) setLoanId(loans[0].id);
    } else {
      const selectedCat = categories.find(c => c.id === categoryId);
      const isLoanCat = selectedCat?.name === 'Trả nợ vay' || selectedCat?.icon === '🏦';
      if (isLoanCat) {
        setIsLoanMode(true);
        if (loans.length > 0 && !loanId) setLoanId(loans[0].id);
      } else {
        setIsLoanMode(false);
      }
    }
  }, [type, categoryId, categories, loans]);

  useEffect(() => {
    const relevantCats = categories.filter(c => c.type === type);
    if (relevantCats.length > 0) {
      const isValid = relevantCats.some(c => c.id === categoryId);
      if (!isValid) setCategoryId(relevantCats[0].id);
    }
  }, [type, categories]);

  // Khi chọn khoản vay, gợi ý tiền lãi và gốc từ bảng kế hoạch
  useEffect(() => {
    if (isLoanMode && loanId && loans.length > 0) {
      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        if (repaymentType === 'payoff') {
          // Tất toán: Tổng tiền = Toàn bộ dư nợ + Lãi dự kiến (Dùng số tuyệt đối)
          const interest = suggestInterest(loan);
          const totalPayoff = loan.remaining_principal + interest;
          setExternalValue(totalPayoff);
          setExternalPrincipal(loan.remaining_principal);
        } else {
          // Trả định kỳ: Tìm trong bảng kế hoạch dòng có tháng và năm khớp với hệ thống
          // Cần map đúng các key mà calculateLoanSchedule mong đợi
          const { schedule } = calculateLoanSchedule({
            principal: loan.principal_amount,
            termMonths: loan.term_months,
            promoRate: loan.promo_rate,
            promoMonths: loan.promo_months,
            baseRate: loan.base_rate,
            marginRate: loan.margin_rate,
            penaltyConfig: loan.penalty_config,
            startDate: loan.start_date,
            firstPaymentDate: loan.first_payment_date,
            extraPayment: loan.extra_payment,
            offsetThreshold: loan.offset_threshold,
            periods: loan.periods || [],
          });

          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const match = schedule.find(row => {
            const d = new Date(row.dateObj);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          });

          if (match) {
            setExternalPrincipal(match.principal);
            setExternalValue(match.total);
          } else {
            // Trường hợp không tìm thấy kỳ khớp (quá hạn hoặc chưa đến kỳ): Để trống
            setExternalPrincipal('');
            setExternalValue('');
          }
        }
      }
    }
  }, [loanId, isLoanMode, repaymentType, loans]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rawAmount <= 0) { setError('Số tiền phải lớn hơn 0'); return; }
    if (!accountId) { setError('Vui lòng chọn tài khoản nguồn'); return; }
    
    setLoading(true);
    setError('');

    try {
      const payload = {
        user_id: user.id,
        account_id: accountId,
        category_id: type !== 'transfer' ? categoryId : null,
        to_account_id: type === 'transfer' ? toAccountId : null,
        amount: rawAmount,
        type: type === 'repayment' ? 'expense' : type,
        date: new Date(date).toISOString(),
        note: note.trim() || (type === 'repayment' ? `Trả nợ ${loans.find(l=>l.id===loanId)?.name}` : ''),
        // Loan fields
        loan_id: isLoanMode ? loanId : null,
        loan_payment_type: isLoanMode ? repaymentType : null,
        loan_principal_amount: isLoanMode ? (repaymentType === 'payoff' ? rawAmount : principalRaw) : 0
      };

      const { error: insertError } = await supabase.from('transactions').insert([payload]);
      if (insertError) throw insertError;
      
      // Nếu là trả nợ vay, cập nhật số dư nợ
      if (isLoanMode && loanId) {
        const principalToDeduct = repaymentType === 'payoff' ? rawAmount : principalRaw;
        await updateLoanBalance(loanId, principalToDeduct);
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi lưu giao dịch');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (newType) => {
    if (type !== newType) {
      // Chỉ xóa số tiền nếu đang chuyển từ tab Trả nợ sang các tab khác
      // (vì tab Trả nợ có tính năng tự điền số tiền gợi ý)
      if (type === 'repayment') {
        resetAmount();
        resetPrincipal();
      }
      
      // Tự động tìm danh mục "Trả nợ vay" nếu là tab Trả nợ
      if (newType === 'repayment') {
        const loanCat = categories.find(c => c.name === 'Trả nợ vay' || c.icon === '🏦');
        if (loanCat) setCategoryId(loanCat.id);
      }

      setType(newType);
      setError('');
    }
  };

  const resetForm = () => {
    resetAmount();
    resetPrincipal();
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('expense');
    setIsLoanMode(false);
  };

  const activeCategories = categories.filter(c => c.type === type);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Thêm giao dịch mới">
      <form onSubmit={handleSubmit} className="space-y-5 h-[80vh] overflow-y-auto px-4 pb-10 no-scrollbar">
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {['expense', 'income', 'transfer', 'repayment'].map(t => (
            <button
              key={t} type="button" onClick={() => handleTypeChange(t)}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all ${type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {t === 'expense' ? 'Chi' : t === 'income' ? 'Thu' : t === 'transfer' ? 'Chuyển' : 'Trả nợ'}
            </button>
          ))}
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">
            {isLoanMode ? 'Tổng số tiền trả (Gốc + Lãi)' : 'Số tiền'}
          </label>
          <div className="relative">
            <input
              type="text" inputMode="numeric" value={displayValue} onChange={handleInputChange}
              className="w-full bg-gray-50 text-gray-900 text-3xl font-black py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-all outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-300">{suffix}</span>
            </div>
          </div>
        </div>

        <div className={type === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Nguồn tiền</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold">
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
          </div>
          {type === 'transfer' && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Đến ví</label>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold">
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {type !== 'transfer' && (
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Hạng mục</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold">
              {activeCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
            </select>
          </div>
        )}

        {/* LOAN SPECIFIC FIELDS */}
        {isLoanMode && (
          <div className="bg-blue-50/50 p-5 rounded-[2rem] border border-blue-100 space-y-5 animate-in slide-in-from-top-2">
            <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center">
              <Landmark size={14} className="mr-2" /> Chi tiết trả nợ vay
            </h4>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Chọn khoản vay</label>
              <select value={loanId} onChange={(e) => setLoanId(e.target.value)} className="w-full bg-white border border-blue-100 rounded-xl px-4 py-3 text-sm font-bold">
                {loans.map(l => <option key={l.id} value={l.id}>{l.name} (Dư nợ: {formatCurrency(l.remaining_principal)}₫)</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
               {['periodic', 'payoff'].map(mode => (
                 <button
                   key={mode} type="button" onClick={() => setRepaymentType(mode)}
                   className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                     repaymentType === mode ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-400 border-gray-100'
                   }`}
                 >
                   {mode === 'periodic' ? 'Trả định kỳ' : 'Tất toán'}
                 </button>
               ))}
            </div>

            {repaymentType === 'periodic' ? (
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Số tiền gốc trả</span>
                  <span className="text-blue-500 font-black italic">
                    Lãi dự kiến: {formatCurrency(suggestInterest(loans.find(l => l.id === loanId)))}₫
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text" inputMode="numeric" value={principalDisplay} onChange={handlePrincipalChange}
                    className="w-full bg-white border border-blue-100 rounded-xl py-3 pl-4 pr-16 text-sm font-black text-blue-600 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    placeholder="VD: 5.000.000"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">{principalSuffix}</span>
                </div>
                <p className="text-[9px] text-gray-400 ml-1">Tổng tiền = Gốc ({formatCurrency(principalRaw)}₫) + Lãi ({formatCurrency(rawAmount - principalRaw)}₫)</p>
              </div>
            ) : (
              <div className="p-3 bg-blue-600 rounded-2xl text-white">
                <div className="flex items-center space-x-2 mb-1">
                   <Calculator size={14} />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Tất toán toàn bộ</span>
                </div>
                <p className="text-xs font-medium opacity-90">Hệ thống đã tính toán toàn bộ dư nợ gốc + lãi dự kiến vào ô "Tổng số tiền" ở trên.</p>
              </div>
            )}
            
            <div className="flex items-start space-x-2 text-[9px] text-blue-400 font-bold italic leading-relaxed">
               <Info size={12} className="mt-0.5 flex-shrink-0" />
               <p>Hệ thống sẽ tự động trừ số tiền gốc vào dư nợ và tính toán lại lãi các tháng sau.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Ngày tháng</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold"/>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Ghi chú</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tùy chọn..." className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold"/>
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full py-4 mt-2 bg-gray-900 text-white font-black text-lg rounded-[2rem] shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center space-x-2"
        >
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Xác nhận giao dịch'}
        </button>
      </form>
    </BottomSheet>
  );
}
