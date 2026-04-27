import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { useLoans } from '../../hooks/useLoans';
import { Trash2, Landmark, Info, Calculator } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { calculateLoanSchedule } from '../../utils/loanCalculator';

export function EditTransactionSheet({ isOpen, onClose, onSuccess, transaction }) {
  
  const { loans, fetchLoans, updateLoanBalance, suggestInterest } = useLoans();
  
  const [type, setType] = useState('expense');
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState(''); 
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');

  // Loan Repayment State
  const [isLoanMode, setIsLoanMode] = useState(false);
  const [loanId, setLoanId] = useState('');
  const [repaymentType, setRepaymentType] = useState('periodic');
  const [oldLoanInfo, setOldLoanInfo] = useState(null); // { loanId: string, principal: number }

  const { displayValue: principalDisplay, value: principalRaw, handleInputChange: handlePrincipalChange, reset: resetPrincipal, suffix: principalSuffix, setExternalValue: setExternalPrincipal } = useCurrencyInput(0, { useShortcut: false });

  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const { displayValue, value: rawAmount, handleInputChange, setExternalValue, suffix } = useCurrencyInput('', { useShortcut: type !== 'repayment' });

  useEffect(() => {
    if (isOpen && transaction) {
      // Xác định type thực sự dựa trên loan_id
      const isRepayment = !!transaction.loan_id;
      setType(isRepayment ? 'repayment' : transaction.type);
      
      setExternalValue(transaction.amount);
      setAccountId(transaction.account_id || '');
      setToAccountId(transaction.to_account_id || '');
      setCategoryId(transaction.category_id || '');
      setNote(transaction.note || '');

      if (isRepayment) {
        setIsLoanMode(true);
        setLoanId(transaction.loan_id);
        setRepaymentType(transaction.loan_payment_type || 'periodic');
        setExternalPrincipal(transaction.loan_principal_amount || 0);
        setOldLoanInfo({
          loanId: transaction.loan_id,
          principal: transaction.loan_principal_amount || 0
        });
      } else {
        setIsLoanMode(false);
        setLoanId('');
        setRepaymentType('periodic');
        setExternalPrincipal(0);
        setOldLoanInfo(null);
      }
      
      // format date to YYYY-MM-DD
      const d = new Date(transaction.date);
      setDate(d.toISOString().split('T')[0]);
      
      fetchDependencies();
      fetchLoans();
    }
  }, [isOpen, transaction]);

  // Đồng bộ isLoanMode khi thay đổi type hoặc category
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

  // Gợi ý tiền lãi và gốc (Giống AddTransactionSheet)
  useEffect(() => {
    // Chỉ tự động gợi ý nếu người dùng vừa mới chọn khoản vay hoặc đổi loại trả nợ
    // Không chạy khi mới mở sheet (để giữ giá trị cũ của transaction)
    if (isLoanMode && loanId && loans.length > 0) {
      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        // Kiểm tra xem đây có phải là loan đang sửa của transaction không
        // Nếu đúng thì không tự động ghi đè giá trị gợi ý khi vừa mở
        const isSameAsOriginal = transaction?.loan_id === loanId;
        if (isSameAsOriginal && repaymentType === transaction?.loan_payment_type) {
           return; 
        }

        if (repaymentType === 'payoff') {
          const interest = suggestInterest(loan);
          const totalPayoff = loan.remaining_principal + interest;
          setExternalValue(totalPayoff);
          setExternalPrincipal(loan.remaining_principal);
        } else {
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

          const now = new Date(date);
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const match = schedule.find(row => {
            const d = new Date(row.dateObj);
            // Cộng thêm 12 giờ để tránh lệch ngày do múi giờ khi so sánh tháng/năm
            const checkDate = new Date(d.getTime() + 12 * 60 * 60 * 1000);
            return checkDate.getMonth() === currentMonth && checkDate.getFullYear() === currentYear;
          });

          if (match) {
            setExternalPrincipal(match.principal);
            setExternalValue(match.total);
          } else {
            setExternalPrincipal('');
            setExternalValue('');
          }
        }
      }
    }
  }, [loanId, repaymentType, loans, date]);

  const fetchDependencies = async () => {
    try {
      const accData = await db.accounts.orderBy('name').toArray();
      setAccounts(accData);
      
      const catData = await db.categories.toArray();
      const sortedCats = catData.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setCategories(sortedCats);
    } catch (err) {
      console.error(err);
    }
  };

  const updateAccountBalances = async (payload, direction = 1) => {
    const { account_id, to_account_id, amount, type } = payload;
    
    // 1. Cập nhật tài khoản nguồn (hoặc duy nhất)
    const fromAcc = await db.accounts.get(account_id);
    if (fromAcc) {
      let diff = 0;
      if (type === 'income') {
        diff = fromAcc.sub_type === 'debt' ? -amount : amount;
      } else {
        diff = fromAcc.sub_type === 'debt' ? amount : -amount;
      }
      await db.accounts.update(account_id, { 
        balance: (fromAcc.balance || 0) + (diff * direction) 
      });
    }

    // 2. Cập nhật tài khoản đích (nếu là chuyển khoản)
    if (type === 'transfer' && to_account_id) {
       const toAcc = await db.accounts.get(to_account_id);
       if (toAcc) {
         const diff = toAcc.sub_type === 'debt' ? -amount : amount;
         await db.accounts.update(to_account_id, { 
           balance: (toAcc.balance || 0) + (diff * direction) 
         });
       }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rawAmount <= 0) { setError('Số tiền phải lớn hơn 0'); return; }
    if (!accountId) { setError('Vui lòng chọn tài khoản nguồn'); return; }
    if (type === 'transfer' && (!toAccountId || accountId === toAccountId)) {
      setError('Tài khoản nhận không hợp lệ');
      return;
    }

    // Kiểm tra số dư tài khoản (ngoại trừ thẻ tín dụng/khoản nợ)
    const selectedAccount = accounts.find(acc => acc.id === accountId);
    const isNewOutgoing = ['expense', 'transfer', 'repayment'].includes(type);
    
    if (isNewOutgoing && selectedAccount && selectedAccount.sub_type !== 'debt') {
      // Tính toán số dư khả dụng thực tế (cộng lại số tiền của giao dịch hiện tại nếu nó từng trừ vào tài khoản này)
      const wasOutgoing = ['expense', 'transfer', 'repayment'].includes(transaction.type) || !!transaction.loan_id;
      const isSameAccount = accountId === transaction.account_id;
      const availableBalance = isSameAccount && wasOutgoing ? selectedAccount.balance + transaction.amount : selectedAccount.balance;

      if (rawAmount > availableBalance) {
        setError(`Số dư tài khoản không đủ (${formatCurrency(availableBalance)}₫)`);
        return;
      }
    }
    
    setLoading(true);
    setError('');

    try {
      const transactionDate = new Date(date);
      const now = new Date();
      // Sử dụng setHours với giờ địa phương để giữ nguyên ngày YYYY-MM-DD bạn chọn theo múi giờ của máy
      transactionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

      const payload = {
        account_id: accountId,
        category_id: categoryId || null,
        to_account_id: type === 'transfer' ? toAccountId : null,
        amount: rawAmount,
        type: type === 'repayment' ? 'expense' : type,
        date: transactionDate.toISOString(),
        note: note.trim(),
        // Loan fields
        loan_id: isLoanMode ? loanId : null,
        loan_payment_type: isLoanMode ? repaymentType : null,
        loan_principal_amount: isLoanMode ? principalRaw : 0
      };

      // 1. Rollback old balance impacts
      await updateAccountBalances(transaction, -1);

      // 2. Update transaction
      await db.transactions.update(transaction.id, payload);

      // 3. Apply new balance impacts
      await updateAccountBalances(payload, 1);

      // Xử lý cập nhật số dư nợ (Rollback & Apply)
      if (oldLoanInfo) {
        // Rollback: Hoàn trả gốc cũ (cộng lại vào dư nợ)
        await updateLoanBalance(oldLoanInfo.loanId, -oldLoanInfo.principal);
      }
      if (isLoanMode && loanId) {
        // Apply: Trừ gốc mới
        await updateLoanBalance(loanId, principalRaw);
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật giao dịch');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm("Bạn muốn xóa giao dịch này? Số dư ví sẽ hoàn trả tương ứng.");
    if (!confirmDelete) return;

    setIsDeleting(true);
    setError('');

    try {
      // Rollback balances
      await updateAccountBalances(transaction, -1);

      await db.transactions.delete(transaction.id);

      // Rollback dư nợ nếu là giao dịch trả nợ
      if (oldLoanInfo) {
        await updateLoanBalance(oldLoanInfo.loanId, -oldLoanInfo.principal);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi xóa giao dịch');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCategories = categories.filter(c => c.type === type);

  if (!transaction) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Sửa giao dịch">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'expense', name: 'Khoản chi' },
            { id: 'income', name: 'Khoản thu' },
            { id: 'transfer', name: 'Chuyển tiền' },
            { id: 'repayment', name: 'Trả nợ' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (type === 'repayment' && t.id !== 'repayment') {
                  setExternalPrincipal(0);
                }

                if (t.id === 'repayment') {
                  // Tự động tìm danh mục "Trả nợ vay" nếu là tab Trả nợ
                  const loanCat = categories.find(c => c.name === 'Trả nợ vay' || c.icon === '🏦');
                  if (loanCat) setCategoryId(loanCat.id);
                } else if (t.id === 'transfer') {
                  // Không chọn danh mục mặc định khi chuyển sang Chuyển tiền
                  setCategoryId('');
                } else {
                  const relevantCats = categories.filter(c => c.type === t.id);
                  const isCatValid = relevantCats.some(c => c.id === categoryId);
                  if (!isCatValid && relevantCats.length > 0) {
                    const defaultCat = relevantCats.find(c => c.is_ui_default);
                    setCategoryId(defaultCat ? defaultCat.id : relevantCats[0].id);
                  }
                }

                setType(t.id);
              }}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all ${
                type === t.id 
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' 
                  : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 rounded-xl text-sm font-medium border border-red-100 dark:border-rose-900/30">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1">
            {isLoanMode ? 'Tổng số tiền trả (Gốc + Lãi)' : 'Số tiền'}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
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
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all truncate"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
          
          {type === 'transfer' ? (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Đến tài khoản</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all truncate"
              >
                <option value="">Chọn...</option>
                {accounts.filter(a => a.id !== accountId).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Hạng mục</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                {categories.filter(c => c.type === (type === 'repayment' ? 'expense' : type)).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Hạng mục cho Chuyển khoản */}
        {type === 'transfer' && (
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Hạng mục (tùy chọn)</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="">-- Không phân loại --</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* LOAN SPECIFIC FIELDS */}
        {isLoanMode && (
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 space-y-5 animate-in slide-in-from-top-2">
            <h4 className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-[0.2em] flex items-center">
              <Landmark size={14} className="mr-2" /> Chi tiết trả nợ vay
            </h4>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Chọn khoản vay</label>
              <select value={loanId} onChange={(e) => setLoanId(e.target.value)} className="w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-blue-100 dark:border-blue-900/30 rounded-xl px-4 py-3 text-sm font-bold">
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
                    className="w-full bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/30 text-gray-900 dark:text-slate-100 rounded-xl py-3 pl-4 pr-16 text-sm font-black text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
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
               <p className="dark:text-blue-400/80">Hệ thống sẽ tự động trừ số tiền gốc vào dư nợ và tính toán lại lãi các tháng sau.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ngày thực hiện</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ghi chú</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tùy chọn..."
              className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-none rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || loading}
            className="px-4 py-4 bg-red-50 dark:bg-rose-900/10 text-red-600 dark:text-rose-400 font-semibold rounded-2xl active:scale-[0.98] transition-all border border-red-100 dark:border-rose-900/30 flex-shrink-0"
          >
            {isDeleting ? <div className="w-5 h-5 border-2 border-red-600 dark:border-rose-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={20} />}
          </button>
          
          <button
            type="submit"
            disabled={loading || isDeleting}
            className="flex-1 py-4 bg-blue-600 dark:bg-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none active:scale-[0.98] transition-transform flex items-center justify-center"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Lưu lại'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
