import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { Plus, Wallet, PiggyBank, TrendingUp, HandCoins, Building, CreditCard } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { AddAccountSheet } from '../components/accounts/AddAccountSheet';
import { EditAccountSheet } from '../components/accounts/EditAccountSheet';
import { AddSavingsSheet } from '../components/wealth/AddSavingsSheet';
import { EditSavingsSheet } from '../components/wealth/EditSavingsSheet';
import { AddInvestmentSheet } from '../components/wealth/AddInvestmentSheet';
import { EditInvestmentSheet } from '../components/wealth/EditInvestmentSheet';
import { AddLoanSheet } from '../components/loans/AddLoanSheet';
import { LoanDetailSheet } from '../components/loans/LoanDetailSheet';
import { useLoans } from '../hooks/useLoans';

export default function Accounts() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'savings', 'invest'
  
  const [accounts, setAccounts] = useState([]);
  const [savings, setSavings] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);

  const { loans, loading: loansLoading, fetchLoans } = useLoans();
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [isLoanDetailOpen, setIsLoanDetailOpen] = useState(false);

  // Sheets
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  const [isAddSavingsOpen, setIsAddSavingsOpen] = useState(false);
  const [isEditSavingsOpen, setIsEditSavingsOpen] = useState(false);
  const [selectedSavings, setSelectedSavings] = useState(null);
  
  const [isAddInvestOpen, setIsAddInvestOpen] = useState(false);
  const [isEditInvestOpen, setIsEditInvestOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState(null);

  useEffect(() => {
    fetchWealthData();
    fetchLoans();
  }, [user]);

  const fetchWealthData = async () => {
    setLoading(true);
    try {
      const accRaw = await db.accounts.toArray();
      const savRaw = await db.savings.toArray();
      const invRaw = await db.investments.toArray();
      
      // Sắp xếp thủ công để tránh mất dữ liệu nếu thiếu trường index
      const accData = accRaw.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const savData = savRaw.sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
      const invData = invRaw.sort((a, b) => new Date(b.purchase_date || 0) - new Date(a.purchase_date || 0));
      
      setAccounts(accData);
      setSavings(savData);
      setInvestments(invData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountClick = (acc) => {
    setSelectedAccount(acc);
    setIsEditAccountOpen(true);
  };

  const handleSavingsClick = (sav) => {
    setSelectedSavings(sav);
    setIsEditSavingsOpen(true);
  };

  const handleInvestmentClick = (inv) => {
    setSelectedInvestment(inv);
    setIsEditInvestOpen(true);
  };

  const handleLoanClick = (loan) => {
    setSelectedLoan(loan);
    setIsLoanDetailOpen(true);
  };

  // --- Calculations ---
  
  const totalCashAndReceivable = accounts.reduce((acc, curr) => {
    if (curr.sub_type === 'debt') return acc;
    return acc + (curr.balance || 0);
  }, 0);

  const totalDebtAccounts = accounts.reduce((acc, curr) => {
    if (curr.sub_type === 'debt') return acc + (curr.balance || 0);
    return acc;
  }, 0);

  // Savings Math
  const computeSavingsMath = (sav) => {
    const daysPassed = Math.max(0, Math.floor((new Date() - new Date(sav.start_date)) / (1000 * 60 * 60 * 24)));
    const dailyRate = ((sav.interest_rate || 0) / 100) / 365;
    const accruedInterest = (sav.principal_amount || 0) * dailyRate * daysPassed;
    const expectedTotalInterest = (sav.principal_amount || 0) * ((sav.interest_rate || 0) / 100) * ((sav.term_months || 0) / 12);
    return { accruedInterest: Math.floor(accruedInterest), expectedTotalInterest: Math.floor(expectedTotalInterest), daysPassed };
  };

  const totalSavingsValue = savings.reduce((acc, curr) => {
    if (curr.status !== 'active') return acc;
    return acc + curr.principal_amount;
  }, 0);

  // Investment Math
  const totalInvestmentNet = investments.reduce((acc, curr) => {
    const marketVal = (curr.current_price || 0) * (curr.type === 'real_estate' ? 1 : (curr.quantity || 1));
    const debt = curr.loan_amount || 0;
    return acc + (marketVal - debt);
  }, 0);

  const totalInvestmentMarketValue = investments.reduce((acc, curr) => {
    const marketVal = (curr.current_price || 0) * (curr.type === 'real_estate' ? 1 : (curr.quantity || 1));
    return acc + marketVal;
  }, 0);

  const totalOtherLiabilities = totalDebtAccounts + loans.reduce((acc, l) => {
    if (l.status === 'active' && !l.linked_investment_id) {
       return acc + (l.remaining_principal ?? l.total_amount ?? 0);
    }
    return acc;
  }, 0);

  const totalLoanRemaining = loans.reduce((acc, l) => acc + (l.status === 'active' ? (l.remaining_principal ?? l.total_amount ?? 0) : 0), 0);
  
  const globalNetWorth = totalCashAndReceivable + totalSavingsValue + totalInvestmentNet - totalOtherLiabilities;
  const activeLoans = loans.filter(l => l.status === 'active');
  const paidOffLoans = loans.filter(l => l.status === 'paid_off');

  // --- Renderers ---

  const renderCashTab = () => {
    const paymentAccounts = accounts.filter(a => a.sub_type === 'payment' || a.sub_type === 'receivable');
    const savingsAccounts = accounts.filter(a => a.sub_type === 'savings');
    const debtAccounts = accounts.filter(a => a.sub_type === 'debt');

    const getAccountIcon = (type, sub_type) => {
      if (sub_type === 'debt') return <CreditCard className="text-red-500" />;
      if (sub_type === 'receivable') return <HandCoins className="text-emerald-500 dark:text-emerald-400" />;
      if (type === 'bank') return <Building className="text-blue-500 dark:text-blue-400" />;
      return <Wallet className="text-gray-700 dark:text-slate-400" />;
    };

    const renderGroup = (title, items) => {
      if (items.length === 0) return null;
      return (
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-3 px-1">{title}</h3>
          <div className="grid grid-cols-1 gap-3">
            {items.map(acc => (
              <div 
                key={acc.id} 
                onClick={() => handleAccountClick(acc)}
                className={`bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border ${acc.sub_type === 'debt' ? 'border-red-50 dark:border-rose-900/30' : acc.sub_type === 'receivable' ? 'border-emerald-50 dark:border-emerald-900/30' : 'border-gray-100 dark:border-white/5'} flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${acc.sub_type === 'debt' ? 'bg-red-50 dark:bg-rose-900/20 border-red-100 dark:border-rose-900/50' : acc.sub_type === 'receivable' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/50' : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-white/5'}`}>
                    {getAccountIcon(acc.type, acc.sub_type)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-slate-100 leading-tight">{acc.name}</h4>
                    <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${acc.sub_type === 'debt' ? 'text-red-500 dark:text-rose-400' : acc.sub_type === 'receivable' ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-slate-500'}`}>
                      {acc.type}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${acc.sub_type === 'debt' ? 'text-red-600 dark:text-rose-400' : acc.sub_type === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-slate-100'}`}>
                    {acc.sub_type === 'debt' ? '-' : acc.sub_type === 'receivable' ? '+' : ''}{formatCurrency(acc.balance)} đ
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-white/5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tiền mặt & Thu</p>
            <p className="text-lg font-black text-gray-900 dark:text-slate-100">{formatCurrency(totalCashAndReceivable)} ₫</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-white/5">
            <p className="text-[10px] font-bold text-red-400 dark:text-rose-400 uppercase tracking-widest mb-1">Nợ thẻ (Thanh toán)</p>
            <p className="text-lg font-black text-red-500 dark:text-rose-400">-{formatCurrency(totalDebtAccounts)} ₫</p>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">Danh sách Ví</h3>
            <button onClick={() => setIsAddAccountOpen(true)} className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold active:scale-95 transition-transform"><Plus size={18} /></button>
          </div>
          
          {accounts.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Chưa có ví nào.</p>}
          {renderGroup('Tài khoản thanh toán', paymentAccounts)}
          {renderGroup('Tài khoản tiết kiệm', savingsAccounts)}
          {renderGroup('Sổ nợ / Thẻ tín dụng', debtAccounts)}
        </div>
      </div>
    );
  };

  const renderSavingsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-emerald-50 dark:border-emerald-900/30">
        <p className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-1">Khối lượng Tiết kiệm</p>
        <p className="text-2xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(totalSavingsValue)} ₫</p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">Các Sổ Tiết Kiệm</h3>
          <button onClick={() => setIsAddSavingsOpen(true)} className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold active:scale-95 transition-transform"><Plus size={18} /></button>
        </div>
        
        {savings.length === 0 && <p className="text-gray-500 dark:text-slate-500 text-sm text-center py-6">Chưa có sổ tiết kiệm nào.</p>}
        {savings.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {savings.map(sav => {
              const { expectedTotalInterest } = computeSavingsMath(sav);
              const isSettled = sav.status !== 'active';
              return (
                <div 
                  key={sav.id} 
                  onClick={() => handleSavingsClick(sav)}
                  className={`p-4 rounded-2xl shadow-sm border ${isSettled ? 'bg-gray-50 dark:bg-slate-800/40 border-gray-100 dark:border-white/5 opacity-60' : 'bg-white dark:bg-slate-900 border-emerald-50 dark:border-emerald-900/30'} relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer`}
                >
                  {isSettled && <div className="absolute top-0 right-0 bg-gray-200 dark:bg-slate-700 text-xs px-2 py-1 font-bold text-gray-600 dark:text-slate-400 rounded-bl-lg">Đã tất toán</div>}
                  <h4 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-1">{sav.name}</h4>
                  <div className="flex space-x-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded w-fit mb-4 border border-emerald-100 dark:border-emerald-900/50">
                    <span>{sav.interest_rate}%/năm</span> • <span>Kỳ hạn {sav.term_months} tháng</span>
                  </div>
                  
                  <div className="flex justify-between items-end border-t border-gray-100 dark:border-white/5 pt-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mb-0.5">Tiền gốc</p>
                      <p className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(sav.principal_amount)} ₫</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-0.5 font-medium">Lãi dự kiến ({sav.term_months} tháng)</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">+{formatCurrency(expectedTotalInterest)} ₫</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderInvestTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-purple-100 dark:border-indigo-900/30">
        <p className="text-[10px] font-bold text-purple-500 dark:text-indigo-400 uppercase tracking-widest mb-1">Tài sản ròng (Equity)</p>
        <p className="text-lg font-black text-gray-900 dark:text-slate-100">{formatCurrency(totalInvestmentNet)} ₫</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-purple-50 dark:border-white/5">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tổng thị trường</p>
          <p className="text-lg font-black text-gray-600 dark:text-slate-400">{formatCurrency(totalInvestmentMarketValue)} ₫</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">Tài sản đang giữ</h3>
          <button onClick={() => setIsAddInvestOpen(true)} className="w-8 h-8 rounded-full bg-purple-100 dark:bg-indigo-900/30 text-purple-600 dark:text-indigo-400 flex items-center justify-center font-bold active:scale-95 transition-transform"><Plus size={18} /></button>
        </div>
        
        {investments.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Chưa có tài sản đầu tư nào.</p>}
        {investments.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {investments.map(inv => {
              const isRE = inv.type === 'real_estate';
              const marketValue = inv.current_price * (isRE ? 1 : inv.quantity);
              const loan = inv.loan_amount || 0;
              const principal = isRE ? (marketValue - loan) : (inv.buy_price * inv.quantity);
              const currentEquity = isRE ? principal : marketValue;
              
              const diff = isRE ? 0 : (marketValue - principal); 
              const profitStr = diff >= 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff);
              
              let icon = '📦';
              if (inv.type === 'gold') icon = '⚡️';
              if (inv.type === 'crypto') icon = '💎';
              if (inv.type === 'stock') icon = '📈';
              if (inv.type === 'real_estate') icon = '🏠';

              return (
                <div 
                  key={inv.id} 
                  onClick={() => handleInvestmentClick(inv)}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${isRE ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50' : 'bg-purple-50 dark:bg-slate-800 border border-purple-100 dark:border-white/5'}`}>{icon}</div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-slate-100 leading-tight">{inv.symbol}</h4>
                        <p className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase mt-0.5 tracking-wider">
                          {isRE ? 'Bất động sản' : `${inv.quantity} đơn vị`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-900 dark:text-slate-100">{formatCurrency(marketValue)} ₫</p>
                      {(inv.buy_price > 0 || !isRE) && (
                        <p className={`text-[10px] font-bold ${diff >= 0 ? 'text-green-500 dark:text-emerald-400' : 'text-red-500 dark:text-rose-400'}`}>
                          {profitStr} ({((diff / (principal || 1)) * 100).toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>

                  {isRE && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-100 dark:border-white/5 grid grid-cols-2 gap-2">
                       <div className="bg-red-50/50 dark:bg-rose-900/20 p-2 rounded-xl">
                         <p className="text-[9px] font-bold text-red-400 dark:text-rose-400 uppercase mb-0.5">Vốn vay (Nợ)</p>
                         <p className="text-xs font-bold text-red-600 dark:text-rose-400">-{formatCurrency(loan)} ₫</p>
                       </div>
                       <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-2 rounded-xl text-right">
                         <p className="text-[9px] font-bold text-emerald-400 uppercase mb-0.5">Vốn gốc (Equity)</p>
                         <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(principal)} ₫</p>
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderLoanCard = (loan) => {
    const total = loan.total_amount || loan.principal_amount || 1; // Fallback to principal_amount if old data
    const remaining = loan.remaining_principal ?? total;
    const progress = Math.round(((total - remaining) / total) * 100);
    return (
      <div 
        key={loan.id} 
        onClick={() => handleLoanClick(loan)}
        className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-rose-900/20 flex items-center justify-center text-red-500 dark:text-rose-400">
              <HandCoins size={20} />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-slate-100 leading-tight">{loan.name}</h4>
              <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                Lãi suất: {loan.interest_rate}%/năm
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-gray-900 dark:text-slate-100 text-lg">{formatCurrency(loan.remaining_principal)} ₫</p>
            <p className="text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase">Đã trả {progress}%</p>
          </div>
        </div>
        
        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-red-400 dark:bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>

        {loan.linked_investment && (
           <div className="mt-4 pt-3 border-t border-dashed border-gray-100 dark:border-white/5 flex items-center text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
             <Building size={12} className="mr-1.5 text-blue-400 dark:text-blue-500" /> Gắn với: {loan.linked_investment.symbol}
           </div>
        )}
      </div>
    );
  };

  // --- Loans Section (always visible, below tabs) ---
  const renderLoansSection = () => {
    if (loansLoading) return null;

    return (
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-rose-900/30 flex items-center justify-center">
              <HandCoins size={16} className="text-red-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-slate-100 text-lg leading-tight">Quản lý Nợ vay</h2>
              {totalLoanRemaining > 0 && (
                <p className="text-xs text-red-500 dark:text-rose-400 font-semibold">
                  Dư nợ: {formatCurrency(totalLoanRemaining)} ₫
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsAddLoanOpen(true)}
            className="w-8 h-8 rounded-full bg-red-100 dark:bg-rose-900/30 text-red-600 dark:text-rose-400 flex items-center justify-center font-bold active:scale-95 transition-transform"
          >
            <Plus size={18} />
          </button>
        </div>

        {loans.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl py-8 text-center text-gray-500 dark:text-slate-500">
            <HandCoins size={28} className="text-gray-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-medium dark:text-slate-400">Chưa có hồ sơ vay nào.</p>
            <p className="text-xs mt-1 dark:text-slate-500">Nhấn + để thêm khoản vay mới</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeLoans.map(renderLoanCard)}
            {paidOffLoans.length > 0 && (
              <>
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] pt-2 px-1">Đã tất toán</h4>
                {paidOffLoans.map(renderLoanCard)}
              </>
            )}
          </div>
        )}
      </div>
    );
  };


  return (
    <>
      <div className="p-4 safe-top pb-24 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6 mt-4">Danh mục Tài sản</h1>
        
        {/* Custom Tabs - 3 tabs only */}
        <div className="flex bg-gray-200/60 dark:bg-slate-900 p-1 rounded-xl mb-6">
          <button onClick={() => setActiveTab('cash')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'cash' ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-500'}`}>Tiền mặt</button>
          <button onClick={() => setActiveTab('savings')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'savings' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-slate-500'}`}>Tiết kiệm</button>
          <button onClick={() => setActiveTab('invest')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'invest' ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-slate-500'}`}>Đầu tư</button>
        </div>

        {loading ? (
           <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div></div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'cash' && renderCashTab()}
            {activeTab === 'savings' && renderSavingsTab()}
            {activeTab === 'invest' && renderInvestTab()}

            {/* Loan Section - always visible below the active tab */}
            {renderLoansSection()}
          </div>
        )}
      </div>

      <AddAccountSheet isOpen={isAddAccountOpen} onClose={() => setIsAddAccountOpen(false)} onSuccess={fetchWealthData} />
      <EditAccountSheet isOpen={isEditAccountOpen} onClose={() => setIsEditAccountOpen(false)} account={selectedAccount} onSuccess={fetchWealthData} />
      <AddSavingsSheet isOpen={isAddSavingsOpen} onClose={() => setIsAddSavingsOpen(false)} onSuccess={fetchWealthData} />
      <EditSavingsSheet isOpen={isEditSavingsOpen} onClose={() => setIsEditSavingsOpen(false)} savings={selectedSavings} onSuccess={fetchWealthData} />
      <AddInvestmentSheet isOpen={isAddInvestOpen} onClose={() => setIsAddInvestOpen(false)} onSuccess={fetchWealthData} />
      <EditInvestmentSheet isOpen={isEditInvestOpen} onClose={() => setIsEditInvestOpen(false)} investment={selectedInvestment} onSuccess={fetchWealthData} />
      <AddLoanSheet isOpen={isAddLoanOpen} onClose={() => setIsAddLoanOpen(false)} onSuccess={fetchLoans} />
      <LoanDetailSheet isOpen={isLoanDetailOpen} onClose={() => setIsLoanDetailOpen(false)} loan={selectedLoan} onUpdated={fetchLoans} />
    </>
  );
}
