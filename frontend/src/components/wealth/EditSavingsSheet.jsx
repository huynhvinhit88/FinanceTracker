import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Trash2, CheckCircle2, X, Landmark, List, Calculator, ArrowLeft } from 'lucide-react';
import { formatCurrency, toViDecimal, fromViDecimal } from '../../utils/format';

export function EditSavingsSheet({ isOpen, onClose, savings, onSuccess }) {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [interestRateDisplay, setInterestRateDisplay] = useState('');
  const [interestRate, setInterestRate] = useState(0);
  const [termMonths, setTermMonths] = useState('');
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [status, setStatus] = useState('active');
  
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceAccountName, setSourceAccountName] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Settlement States
  const [isSettling, setIsSettling] = useState(false);
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settleCategoryId, setSettleCategoryId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);

  const { displayValue, value: principalAmount, handleInputChange, setExternalValue, suffix } = useCurrencyInput('');
  
  const { 
    displayValue: interestDisplay, 
    value: actualInterest, 
    handleInputChange: handleInterestChange, 
    setExternalValue: setExternalInterest,
    reset: resetInterest 
  } = useCurrencyInput(0);

  useEffect(() => {
    if (isOpen && savings) {
      setName(savings.name);
      setExternalValue(savings.principal_amount);
      setInterestRate(savings.interest_rate);
      setInterestRateDisplay(toViDecimal(savings.interest_rate));
      setTermMonths(savings.term_months?.toString() || '');
      setStartDate(savings.start_date || '');
      setMaturityDate(savings.maturity_date || '');
      setStatus(savings.status);
      setError('');
      setIsSettling(false);
      
      if (savings.account_id) {
        db.accounts.get(savings.account_id).then(acc => {
          if (acc) {
            setSourceAccountName(acc.name);
            setSettleAccountId(acc.id);
          }
        }).catch(console.error);
      } else {
        setSourceAccountName('Không xác định');
      }

      fetchDependencies();
    }
  }, [isOpen, savings]);

  useEffect(() => {
    if (isOpen && startDate && termMonths) {
      const date = new Date(startDate);
      const months = parseInt(termMonths);
      if (!isNaN(months)) {
        date.setMonth(date.getMonth() + months);
        const calculatedMaturity = date.toISOString().split('T')[0];
        // Only auto-update if it was empty or definitely needs a refresh 
        // (to avoid overriding manual user adjustments immediately after load)
        if (!maturityDate || (savings && savings.start_date !== startDate) || (savings && savings.term_months !== months)) {
           // We'll let the user override, but here we provide a sensible default
        }
      }
    }
  }, [startDate, termMonths, isOpen]);

  const fetchDependencies = async () => {
    try {
      const accs = await db.accounts.filter(a => a.sub_type !== 'debt').toArray();
      setAccounts(accs);
      
      const cats = await db.categories.filter(c => c.type === 'income').toArray();
      setCategories(cats);
      const interestCat = cats.find(c => c.name.toLowerCase().includes('lãi') || c.name.toLowerCase().includes('tiết kiệm'));
      if (interestCat) setSettleCategoryId(interestCat.id);
      else if (cats.length > 0) setSettleCategoryId(cats[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vui lòng nhập tên sổ');
    if (principalAmount <= 0) return setError('Số tiền gửi phải lớn hơn 0');
    if (interestRate < 0) return setError('Lãi suất không hợp lệ');
    if (!termMonths || parseInt(termMonths) <= 0) return setError('Kỳ hạn phải lớn hơn 0 tháng');
    
    setLoading(true);
    setError('');

    try {
      await db.savings.update(savings.id, {
        name: name.trim(),
        principal_amount: principalAmount,
        interest_rate: interestRate,
        term_months: parseInt(termMonths),
        start_date: startDate,
        maturity_date: maturityDate,
        status: status
      });
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật sổ tiết kiệm');
    } finally {
      setLoading(false);
    }
  };

  const projectedInterest = Math.round(principalAmount * (interestRate / 100) * (parseInt(termMonths) / 12));

  const handleSettleToggle = () => {
    if (!isSettling) {
      setExternalInterest(projectedInterest);
      setIsSettling(true);
    } else {
      setIsSettling(false);
    }
  };

  const handleConfirmSettle = async () => {
    if (!settleAccountId) return setError('Vui lòng chọn tài khoản nhận tiền');
    if (!settleCategoryId) return setError('Vui lòng chọn hạng mục');
    
    setSettleLoading(true);
    setError('');

    try {
      const totalAmount = savings.principal_amount + actualInterest;
      const account = await db.accounts.get(settleAccountId);

      if (account) {
        // 1. Cập nhật số dư tài khoản nhận
        await db.accounts.update(settleAccountId, {
          balance: account.balance + totalAmount
        });

        const txDate = new Date().toISOString();

        // 2.a Tạo giao dịch nhận lại gốc (Chuyển tiền)
        await db.transactions.add({
          id: crypto.randomUUID(),
          account_id: settleAccountId,
          amount: savings.principal_amount,
          date: txDate,
          type: 'transfer',
          note: `Nhận gốc tất toán: ${savings.name}`
        });

        // 2.b Tạo giao dịch nhận lãi (Thu nhập) nếu có
        if (actualInterest > 0) {
          await db.transactions.add({
            id: crypto.randomUUID(),
            account_id: settleAccountId,
            category_id: settleCategoryId,
            amount: actualInterest,
            date: txDate,
            type: 'income',
            note: `Lãi tất toán: ${savings.name}`
          });
        }
      }

      // 3. Cập nhật trạng thái sổ tiết kiệm
      await db.savings.update(savings.id, { status: 'settled' });
      
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
      await db.savings.delete(savings.id);
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
    <BottomSheet isOpen={isOpen} onClose={onClose} title={isSettling ? "Chi tiết tất toán sổ" : "Sửa sổ tiết kiệm"}>
      <form onSubmit={e => e.preventDefault()} className="space-y-5 pb-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 rounded-xl text-sm font-medium border border-red-100 dark:border-rose-900/30">
            {error}
          </div>
        )}

        {!isSettling ? (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Tên sổ tiết kiệm</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-blue-500 dark:focus:border-indigo-500 rounded-xl px-4 py-3 outline-none transition-all text-gray-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Số tiền gốc (VND)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayValue}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 text-2xl font-bold py-3 pr-24 pl-4 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none transition-all"
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                  <span className="text-xl font-bold text-gray-400 dark:text-slate-600">{suffix}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Lãi suất (%/năm)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={interestRateDisplay}
                  onChange={e => {
                    const raw = e.target.value;
                    if (!/^[\d,.]*$/.test(raw)) return;
                    setInterestRateDisplay(raw);
                    const parsed = fromViDecimal(raw);
                    if (!isNaN(parsed)) setInterestRate(parsed);
                  }}
                  onBlur={() => setInterestRateDisplay(toViDecimal(interestRate))}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-blue-500 dark:focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-medium text-gray-900 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Kỳ hạn (Tháng)</label>
                <input
                  type="number"
                  value={termMonths}
                  onChange={e => setTermMonths(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-blue-500 dark:focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-medium text-gray-900 dark:text-slate-100 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Ngày gửi</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-blue-500 dark:focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-medium text-gray-900 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Ngày tất toán</label>
                <input
                  type="date"
                  value={maturityDate}
                  onChange={e => setMaturityDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-blue-500 dark:focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-medium text-gray-900 dark:text-slate-100 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border border-transparent dark:border-white/5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tài khoản nguồn</label>
                <p className="font-bold text-gray-900 dark:text-slate-100">{sourceAccountName}</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1 text-right">Trạng thái</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)}
                  className="bg-transparent font-bold text-gray-900 dark:text-slate-100 outline-none transition-all text-sm"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="settled">Đã tất toán</option>
                </select>
              </div>
            </div>

              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
             <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/30">
               <div className="flex justify-between items-start mb-4">
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/50 uppercase tracking-widest">Gốc ban đầu</p>
                   <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(savings.principal_amount)}₫</p>
                 </div>
                 <div className="text-right space-y-1">
                   <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/50 uppercase tracking-widest">Lãi dự kiến</p>
                   <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(projectedInterest)}₫</p>
                 </div>
               </div>

               <div className="space-y-1">
                <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1 flex items-center">
                  <Calculator size={12} className="mr-1" /> Tiền lãi thực nhận
                </label>
                <div className="relative">
                  <input
                    type="text" inputMode="numeric" value={interestDisplay} onChange={handleInterestChange}
                    className="w-full bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 text-2xl font-black py-3 px-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-300 dark:text-emerald-800 font-bold">VNĐ</div>
                </div>
              </div>
             </div>

             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                    <Landmark size={12} className="mr-1" /> Nhận tiền tại
                  </label>
                  <select 
                    value={settleAccountId} onChange={e => setSettleAccountId(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-none rounded-xl px-3 py-3 text-xs font-bold"
                  >
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                    <List size={12} className="mr-1" /> Hạng mục
                  </label>
                  <select 
                    value={settleCategoryId} onChange={e => setSettleCategoryId(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-none rounded-xl px-3 py-3 text-xs font-bold"
                  >
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
             </div>

             <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-medium italic bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl">
               <X size={14} className="text-red-400 flex-shrink-0" />
               <p>Hành động này sẽ cộng <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(principalAmount + actualInterest)}₫</span> vào tài khoản. Trong đó Tiền gốc được tính là "Chuyển tiền", Tiền lãi được tính là "Khoản thu".</p>
             </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 pt-4">
          {!isSettling ? (
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading || loading || settleLoading}
                className="py-3 bg-gray-100 dark:bg-red-900/10 text-red-600 dark:text-rose-400 font-bold rounded-2xl active:scale-95 transition-all flex flex-col items-center justify-center text-[10px] space-y-1 border border-transparent dark:border-red-900/30"
              >
                {deleteLoading ? (
                  <div className="w-4 h-4 border-2 border-red-600 dark:border-rose-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Trash2 size={20} /><span>Xoá</span></>
                )}
              </button>
              
              {status === 'active' ? (
                <button
                  type="button"
                  onClick={handleSettleToggle}
                  className="py-3 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold rounded-2xl active:scale-95 transition-all flex flex-col items-center justify-center text-[10px] space-y-1 border border-transparent dark:border-emerald-900/30"
                >
                  <CheckCircle2 size={20} /><span>Tất toán</span>
                </button>
              ) : (
                <div className="py-3 bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-600 font-bold rounded-2xl flex flex-col items-center justify-center text-[10px] space-y-1 opacity-50 cursor-not-allowed border border-transparent dark:border-white/5">
                  <CheckCircle2 size={20} /><span>Tất toán</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || deleteLoading || settleLoading}
                className="col-span-1 py-3 bg-blue-600 dark:bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 dark:shadow-none active:scale-95 transition-all flex items-center justify-center"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Lưu'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsSettling(false)}
                className="py-3 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-bold rounded-2xl active:scale-95 transition-all flex flex-col items-center justify-center text-[10px] space-y-1 border border-transparent dark:border-white/5"
              >
                <ArrowLeft size={20} /><span>Quay lại</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmSettle}
                disabled={settleLoading}
                className="col-span-2 py-3 bg-emerald-600 dark:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-none active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                {settleLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Xác nhận Tất toán</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
