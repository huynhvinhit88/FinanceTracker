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
            setExternalPrincipal('');
            setExternalValue('');
          }
        }
      }
    }
  }, [loanId, repaymentType, loans]);

  const fetchDependencies = async () => {
    try {
      const accData = await db.accounts.orderBy('name').toArray();
      setAccounts(accData);
      
      const catData = await db.categories.toArray();
      setCategories(catData);
    } catch (err) {
      console.error(err);
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
      const payload = {
        account_id: accountId,
        category_id: type !== 'transfer' ? categoryId : null,
        to_account_id: type === 'transfer' ? toAccountId : null,
        amount: rawAmount,
        type: type === 'repayment' ? 'expense' : type,
        date: new Date(date).toISOString(),
        note: note.trim(),
        // Loan fields
        loan_id: isLoanMode ? loanId : null,
        loan_payment_type: isLoanMode ? repaymentType : null,
        loan_principal_amount: isLoanMode ? principalRaw : 0
      };

      await db.transactions.update(transaction.id, payload);

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
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
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
                
                // Tự động tìm danh mục "Trả nợ vay" nếu là tab Trả nợ
                if (t.id === 'repayment') {
                  const loanCat = categories.find(c => c.name === 'Trả nợ vay' || c.icon === '🏦');
                  if (loanCat) setCategoryId(loanCat.id);
                }

                setType(t.id);
                const relevantCats = categories.filter(c => c.type === (t.id === 'repayment' ? 'expense' : t.id));
                // Nếu đổi sang tab nợ vay mà chưa có category được chọn, hoặc category hiện tại không thuộc Expense
                const isCatValid = relevantCats.some(c => c.id === categoryId);
                if (!isCatValid && relevantCats.length > 0) {
                  setCategoryId(relevantCats[0].id);
                }
              }}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all ${
                type === t.id 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">
            {isLoanMode ? 'Tổng số tiền trả (Gốc + Lãi)' : 'Số tiền'}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              className="w-full bg-gray-50 text-gray-900 text-3xl font-black py-4 pr-24 pl-4 rounded-2xl border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-all outline-none"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <span className="text-xl font-bold text-gray-300">{suffix}</span>
            </div>
          </div>
        </div>

        <div className={type === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Từ tài khoản</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none truncate"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
          
          {type === 'transfer' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Đến tài khoản</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none truncate"
              >
                <option value="">Chọn...</option>
                {accounts.filter(a => a.id !== accountId).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {type !== 'transfer' && (
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Danh mục</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold outline-none"
            >
              {categories.filter(c => c.type === (type === 'repayment' ? 'expense' : type)).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
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

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Số tiền gốc trả</span>
                  {repaymentType === 'periodic' && (
                    <span className="text-blue-500 font-black italic">
                      Lãi dự kiến: {formatCurrency(suggestInterest(loans.find(l => l.id === loanId)))}₫
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text" inputMode="numeric" value={principalDisplay} onChange={handlePrincipalChange}
                    className="w-full bg-white border border-blue-100 rounded-xl py-3 pl-4 pr-16 text-sm font-black text-blue-600 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    placeholder="VD: 5.000.000"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">{principalSuffix}</span>
                </div>
                {repaymentType === 'payoff' && (
                  <p className="text-[9px] text-gray-400 ml-1">Kế hoạch: Trả toàn bộ dư nợ gốc {formatCurrency(loans.find(l => l.id === loanId)?.remaining_principal)}₫</p>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Ngày thực hiện</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Ghi chú</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold outline-none"
            />
          </div>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || loading}
            className="px-4 py-4 bg-red-50 text-red-600 font-semibold rounded-2xl active:scale-[0.98] transition-all border border-red-100 flex-shrink-0"
          >
            {isDeleting ? <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={20} />}
          </button>
          
          <button
            type="submit"
            disabled={loading || isDeleting}
            className="flex-1 py-4 bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Lưu lại'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
