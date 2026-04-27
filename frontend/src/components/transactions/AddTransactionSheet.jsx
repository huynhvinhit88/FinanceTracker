import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { useLoans } from '../../hooks/useLoans';
import { Landmark, Info, Calculator } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { calculateLoanSchedule } from '../../utils/loanCalculator';

export function AddTransactionSheet({ isOpen, onClose, onSuccess, initialData }) {
  const { loans, fetchLoans, updateLoanBalance, suggestInterest, getLoanTransactions } = useLoans();
  
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
  const [isFirstRenderFromInitialData, setIsFirstRenderFromInitialData] = useState(false);
  const [loanTransactions, setLoanTransactions] = useState([]);

  const { displayValue, value: rawAmount, handleInputChange, reset: resetAmount, suffix, setExternalValue } = useCurrencyInput(0, { useShortcut: type !== 'repayment' });

  useEffect(() => {
    if (isOpen) {
      resetForm();
      if (initialData) {
        setType(initialData.type || 'repayment');
        if (initialData.amount !== undefined && initialData.amount !== null) setExternalValue(initialData.amount);
        if (initialData.loanId) setLoanId(initialData.loanId);
        if (initialData.principal !== undefined && initialData.principal !== null) setExternalPrincipal(initialData.principal);
        if (initialData.date) {
            const d = new Date(initialData.date);
            setDate(d.toISOString().split('T')[0]);
        }
        if (initialData.note) setNote(initialData.note);
        setIsLoanMode(initialData.type === 'repayment' || !!initialData.loanId);
        setIsFirstRenderFromInitialData(true);
      } else {
        setIsFirstRenderFromInitialData(false);
      }
      fetchDependencies();
      fetchLoans();
    }
  }, [isOpen, initialData]);

  const fetchDependencies = async () => {
    try {
      const accData = await db.accounts.orderBy('name').toArray();
      setAccounts(accData);
      if (accData.length > 0) setAccountId(accData[0].id);

      const catData = await db.categories.toArray();
      const typeOrder = { expense: 1, income: 2, savings: 3 };
      const sortedCats = [...catData].sort((a, b) => {
        const orderA = typeOrder[a.type] || 99;
        const orderB = typeOrder[b.type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
      setCategories([...sortedCats]);
      
      const currentType = initialData?.type || type;
      const relevantCats = sortedCats.filter(c => c.type === currentType);
      if (relevantCats.length > 0) {
        const isCurrentValid = relevantCats.some(c => c.id === categoryId);
        if (!isCurrentValid) {
          const defaultCat = relevantCats.find(c => c.is_ui_default);
          setCategoryId(defaultCat ? defaultCat.id : relevantCats[0].id);
        }
      }

    } catch (err) {
      console.error(err);
      setError('Lỗi khi lấy dữ liệu: ' + err.message);
    }
  };

  useEffect(() => {
    if (loanId) {
      getLoanTransactions(loanId).then(setLoanTransactions);
    } else {
      setLoanTransactions([]);
    }
  }, [loanId, getLoanTransactions]);

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
    if (type === 'repayment') {
      const loanCat = categories.find(c => c.name === 'Trả nợ vay' || c.icon === '🏦');
      if (loanCat) {
        setCategoryId(loanCat.id);
        return;
      }
    }

    if (type === 'transfer') {
      setCategoryId('');
      return;
    }

    const relevantCats = categories.filter(c => c.type === type);
    if (relevantCats.length > 0) {
      const isValid = relevantCats.some(c => c.id === categoryId);
      if (!isValid) {
        const defaultCat = relevantCats.find(c => c.is_ui_default);
        setCategoryId(defaultCat ? defaultCat.id : relevantCats[0].id);
      }
    }
  }, [type, categories]);

  // Khi chọn khoản vay, gợi ý tiền lãi và gốc từ bảng kế hoạch
  useEffect(() => {
    if (isLoanMode && loanId && loans.length > 0) {
      if (isFirstRenderFromInitialData) {
        setIsFirstRenderFromInitialData(false);
        return;
      }

      const loan = loans.find(l => l.id === loanId);
      if (loan) {
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
        }, loanTransactions, loan.remaining_principal);

        const now = new Date(date);
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const match = schedule.find(row => {
          const d = new Date(row.dateObj);
          const checkDate = new Date(d.getTime() + 12 * 60 * 60 * 1000);
          return checkDate.getMonth() === currentMonth && checkDate.getFullYear() === currentYear;
        });

        if (repaymentType === 'payoff') {
          if (match && match.prepay > 0) {
            // Trường hợp 1: Có trả thêm dự kiến trong kỳ này
            setExternalPrincipal(match.prepay);
            setExternalValue(match.prepay + match.penalty);
          } else {
            // Trường hợp 2: Không có trả thêm dự kiến -> Gợi ý tất toán toàn bộ
            const interest = suggestInterest(loan);
            
            // Tính phí phạt toàn bộ dựa trên cấu hình
            const currentMonthIdx = match ? match.month : 1;
            const year = Math.ceil(currentMonthIdx / 12);
            const rates = (loan.penalty_config || '0').split(',').map(s => parseFloat(s.trim()));
            const pRate = rates.length ? (year <= rates.length ? rates[year - 1] : rates[rates.length - 1]) : 0;
            const penalty = loan.remaining_principal * (isNaN(pRate) ? 0 : pRate / 100);
            
            setExternalPrincipal(loan.remaining_principal);
            setExternalValue(loan.remaining_principal + interest + penalty);
          }
        } else {
          // Trả định kỳ
          if (match) {
            setExternalPrincipal(match.principal);
            setExternalValue(match.principal + match.interest);
          } else {
            setExternalPrincipal('');
            setExternalValue('');
          }
        }
      }
    }
  }, [loanId, isLoanMode, repaymentType, loans, date, loanTransactions]);

  const updateAccountBalances = async (payload, direction = 1) => {
    const { account_id, to_account_id, amount, type } = payload;
    
    // 1. Cập nhật tài khoản nguồn (hoặc duy nhất)
    const fromAcc = await db.accounts.get(account_id);
    if (fromAcc) {
      let diff = 0;
      if (type === 'income') {
        // Thu nhập: + vào ví thường, - vào ví nợ
        diff = fromAcc.sub_type === 'debt' ? -amount : amount;
      } else {
        // Chi tiêu/Chuyển/Trả nợ: - vào ví thường, + vào ví nợ
        diff = fromAcc.sub_type === 'debt' ? amount : -amount;
      }
      
      // Áp dụng direction (1 là thêm mới, -1 là rollback)
      await db.accounts.update(account_id, { 
        balance: fromAcc.balance + (diff * direction) 
      });
    }

    // 2. Cập nhật tài khoản đích (nếu là chuyển khoản)
    if (type === 'transfer' && to_account_id) {
       const toAcc = await db.accounts.get(to_account_id);
       if (toAcc) {
         // Chuyển đến: + vào ví thường, - vào ví nợ
         const diff = toAcc.sub_type === 'debt' ? -amount : amount;
         await db.accounts.update(to_account_id, { 
           balance: toAcc.balance + (diff * direction) 
         });
       }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rawAmount <= 0) { setError('Số tiền phải lớn hơn 0'); return; }
    if (!accountId) { setError('Vui lòng chọn tài khoản nguồn'); return; }

    // Kiểm tra số dư tài khoản (ngoại trừ thẻ tín dụng/khoản nợ)
    const selectedAccount = accounts.find(acc => acc.id === accountId);
    const isOutgoing = ['expense', 'transfer', 'repayment'].includes(type);
    if (isOutgoing && selectedAccount && selectedAccount.sub_type !== 'debt') {
      if (rawAmount > selectedAccount.balance) {
        setError(`Số dư tài khoản không đủ (${formatCurrency(selectedAccount.balance)}₫)`);
        return;
      }
    }
    
    setLoading(true);
    setError('');

    try {
      const transactionDate = new Date(date);
      const now = new Date();
      // Sử dụng setHours với các thành phần của giờ địa phương 
      // để đảm bảo ngày bạn chọn luôn được giữ đúng theo múi giờ địa phương.
      transactionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

      const payload = {
        id: crypto.randomUUID(),
        account_id: accountId,
        category_id: categoryId || null,
        to_account_id: type === 'transfer' ? toAccountId : null,
        amount: rawAmount,
        type: type === 'repayment' ? 'expense' : type,
        date: transactionDate.toISOString(),
        note: note.trim() || (type === 'repayment' ? `Trả nợ ${loans.find(l=>l.id===loanId)?.name}` : ''),
        loan_id: isLoanMode ? loanId : null,
        loan_payment_type: isLoanMode ? repaymentType : null,
        loan_principal_amount: isLoanMode ? principalRaw : 0
      };

      await db.transactions.add(payload);
      
      // Cập nhật số dư tài khoản
      await updateAccountBalances(payload);

      // Nếu là trả nợ vay, cập nhật số dư nợ
      if (isLoanMode && loanId) {
        await updateLoanBalance(loanId, principalRaw);
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
      if (type === 'repayment') {
        resetAmount();
        resetPrincipal();
      }

      if (newType === 'repayment') {
        const loanCat = categories.find(c => c.name === 'Trả nợ vay' || c.icon === '🏦');
        if (loanCat) setCategoryId(loanCat.id);
      } else if (newType === 'transfer') {
        // Không chọn danh mục mặc định khi chuyển khoản
        setCategoryId('');
      }

      setType(newType);
      setError('');
    }
  };

  const resetForm = () => {
    resetAmount();
    resetPrincipal();
    setNote('');
    setCategoryId('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('expense');
    setIsLoanMode(false);
  };

  const activeCategories = categories.filter(c => type === 'repayment' ? c.type === 'expense' : c.type === type);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Thêm giao dịch mới">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'expense', name: 'Khoản chi' },
            { id: 'income', name: 'Khoản thu' },
            { id: 'transfer', name: 'Chuyển tiền' },
            { id: 'repayment', name: 'Trả nợ' }
          ].map(t => (
            <button
              key={t.id} type="button" onClick={() => handleTypeChange(t.id)}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all ${type === t.id ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {error && <div className="p-3 bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 rounded-xl text-sm font-medium border border-red-100 dark:border-rose-900/30">{error}</div>}

        <div>
          <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1">
            {isLoanMode ? 'Tổng số tiền trả (Gốc + Lãi)' : 'Số tiền'}
          </label>
          <div className="relative">
            <input
              type="text" inputMode="numeric" value={displayValue} onChange={handleInputChange}
              className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-3xl font-black py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-all outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-300 dark:text-slate-600">{suffix}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nguồn tiền</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500">
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
          </div>
          
          {type === 'transfer' ? (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Đến tài khoản</label>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all truncate">
                <option value="">Chọn...</option>
                {accounts.filter(a => a.id !== accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Hạng mục</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                {activeCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
              </select>
            </div>
          )}

          {/* Danh mục cho Chuyển khoản */}
          {type === 'transfer' && (
            <div className="space-y-1 col-span-2">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Hạng mục (tùy chọn)</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                <option value="">-- Không phân loại --</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* LOAN SPECIFIC FIELDS */}
        {isLoanMode && (
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 space-y-5 animate-in slide-in-from-top-2">
            <h4 className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-[0.2em] flex items-center">
              <Landmark size={14} className="mr-2" /> Chi tiết trả nợ vay
            </h4>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Chọn khoản vay</label>
              <select value={loanId} onChange={(e) => setLoanId(e.target.value)} className="w-full bg-white dark:bg-slate-800 dark:text-slate-100 border border-blue-100 dark:border-blue-900/30 rounded-xl px-4 py-3 text-sm font-bold">
                {loans.map(l => <option key={l.id} value={l.id}>{l.name} (Dư nợ: {formatCurrency(l.remaining_principal)}₫)</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
               {['periodic', 'payoff'].map(mode => (
                 <button
                   key={mode} type="button" onClick={() => setRepaymentType(mode)}
                   className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                     repaymentType === mode ? 'bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-100 dark:border-white/5'
                   }`}
                 >
                   {mode === 'periodic' ? 'Trả định kỳ' : 'Tất toán'}
                 </button>
               ))}
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Số tiền gốc trả</span>
                  {repaymentType === 'periodic' && (
                    <span className="text-blue-500 dark:text-blue-400 font-black italic">
                      Lãi dự kiến: {formatCurrency(suggestInterest(loans.find(l => l.id === loanId)))}₫
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text" inputMode="numeric" value={principalDisplay} onChange={handlePrincipalChange}
                    className="w-full bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/30 rounded-xl py-3 pl-4 pr-16 text-sm font-black text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    placeholder="VD: 5.000.000"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300 dark:text-slate-600">{principalSuffix}</span>
                </div>
                {repaymentType === 'payoff' && (
                  <p className="text-[9px] text-gray-400 dark:text-slate-500 ml-1">Kế hoạch: Trả toàn bộ dư nợ gốc {formatCurrency(loans.find(l => l.id === loanId)?.remaining_principal)}₫</p>
                )}
              </div>

              {rawAmount - principalRaw !== 0 && (
                <div className={`p-3 rounded-2xl flex items-center justify-between ${rawAmount - principalRaw > 0 ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'}`}>
                  <div className="flex items-center space-x-2">
                    <Calculator size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {rawAmount - principalRaw > 0 ? 'Phí & lãi phát sinh' : 'Giảm trừ/Chiết khấu'}
                    </span>
                  </div>
                  <p className="text-xs font-black">{formatCurrency(Math.abs(rawAmount - principalRaw))}₫</p>
                </div>
              )}
            </div>
            
            <div className="flex items-start space-x-2 text-[9px] text-blue-400 font-bold italic leading-relaxed">
               <Info size={12} className="mt-0.5 flex-shrink-0" />
               <p>Hệ thống sẽ tự động trừ số tiền gốc vào dư nợ và tính toán lại lãi các tháng sau.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ngày thực hiện</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 text-sm"/>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ghi chú</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tùy chọn..." className="w-full bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 text-sm"/>
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full py-4 bg-blue-600 dark:bg-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none active:scale-[0.98] transition-transform flex items-center justify-center"
        >
          {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Xác nhận giao dịch'}
        </button>
      </form>
    </BottomSheet>
  );
}
