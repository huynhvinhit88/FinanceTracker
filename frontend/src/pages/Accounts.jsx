import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Wallet, PiggyBank, TrendingUp, HandCoins, Building, CreditCard } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { AddAccountSheet } from '../components/accounts/AddAccountSheet';
import { EditAccountSheet } from '../components/accounts/EditAccountSheet';
import { AddSavingsSheet } from '../components/wealth/AddSavingsSheet';
import { EditSavingsSheet } from '../components/wealth/EditSavingsSheet';
import { AddInvestmentSheet } from '../components/wealth/AddInvestmentSheet';
import { EditInvestmentSheet } from '../components/wealth/EditInvestmentSheet';

export default function Accounts() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'savings', 'invest'
  
  const [accounts, setAccounts] = useState([]);
  const [savings, setSavings] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, [user]);

  const fetchWealthData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [accRes, savRes, invRes] = await Promise.all([
        supabase.from('accounts').select('*').order('name'),
        supabase.from('savings').select('*').order('created_at', { ascending: false }),
        supabase.from('investments').select('*').order('created_at', { ascending: false })
      ]);
      
      if (accRes.error) throw accRes.error;
      if (savRes.error) throw savRes.error;
      if (invRes.error) throw invRes.error;

      setAccounts(accRes.data || []);
      setSavings(savRes.data || []);
      setInvestments(invRes.data || []);
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

  // --- Calculations ---
  
  const totalCashAndDebt = accounts.reduce((acc, curr) => {
    if (curr.sub_type === 'debt') return acc;
    return acc + curr.balance;
  }, 0);

  // Savings Math
  const computeSavingsMath = (sav) => {
    const daysPassed = Math.max(0, Math.floor((new Date() - new Date(sav.start_date)) / (1000 * 60 * 60 * 24)));
    const dailyRate = (sav.interest_rate / 100) / 365;
    const accruedInterest = sav.principal_amount * dailyRate * daysPassed;
    return { accruedInterest: Math.floor(accruedInterest), daysPassed };
  };

  const totalSavingsValue = savings.reduce((acc, curr) => {
    if (curr.status !== 'active') return acc;
    const { accruedInterest } = computeSavingsMath(curr);
    return acc + curr.principal_amount + accruedInterest;
  }, 0);

  // Investment Math
  const totalInvestmentCurrent = investments.reduce((acc, curr) => {
    if (curr.type === 'real_estate') {
      return acc + (curr.current_price - (curr.loan_amount || 0));
    }
    return acc + (curr.current_price * curr.quantity);
  }, 0);

  const totalInvestmentMarketValue = investments.reduce((acc, curr) => {
    return acc + (curr.current_price * (curr.type === 'real_estate' ? 1 : curr.quantity));
  }, 0);

  const totalInvestmentCost = investments.reduce((acc, curr) => {
    if (curr.type === 'real_estate') return acc + curr.buy_price;
    return acc + (curr.buy_price * curr.quantity);
  }, 0);

  const diffInvest = totalInvestmentCurrent - totalInvestmentCost;
  const isInvestProfit = diffInvest >= 0;

  // --- Renderers ---

  const renderCashTab = () => {
    const paymentAccounts = accounts.filter(a => a.sub_type === 'payment');
    const savingsAccounts = accounts.filter(a => a.sub_type === 'savings');
    const debtAccounts = accounts.filter(a => a.sub_type === 'debt');

    const getAccountIcon = (type, sub_type) => {
      if (sub_type === 'debt') return <CreditCard className="text-red-500" />;
      if (type === 'bank') return <Building className="text-blue-500" />;
      return <Wallet className="text-gray-700" />;
    };

    const renderGroup = (title, items) => {
      if (items.length === 0) return null;
      return (
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 text-lg mb-3 px-1">{title}</h3>
          <div className="grid grid-cols-1 gap-3">
            {items.map(acc => (
              <div 
                key={acc.id} 
                onClick={() => handleAccountClick(acc)}
                className={`bg-white p-4 rounded-2xl shadow-sm border ${acc.sub_type === 'debt' ? 'border-red-50' : 'border-gray-100'} flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${acc.sub_type === 'debt' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                    {getAccountIcon(acc.type, acc.sub_type)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 leading-tight">{acc.name}</h4>
                    <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${acc.sub_type === 'debt' ? 'text-red-500' : 'text-gray-500'}`}>
                      {acc.type}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${acc.sub_type === 'debt' ? 'text-red-600' : 'text-gray-900'}`}>
                    {acc.sub_type === 'debt' ? '-' : ''}{formatCurrency(acc.balance)} đ
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
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet size={80} /></div>
          <p className="text-blue-100 font-medium mb-1 relative z-10">Tổng tiền mặt & thẻ</p>
          <h2 className="text-3xl font-bold tracking-tight relative z-10">{formatCurrency(totalCashAndDebt)} ₫</h2>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 text-lg">Danh sách Ví</h3>
            <button onClick={() => setIsAddAccountOpen(true)} className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold active:scale-95 transition-transform"><Plus size={18} /></button>
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
      {/* Savings Overview */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -bottom-4 -right-4 opacity-20"><PiggyBank size={100} /></div>
        <p className="text-emerald-100 font-medium mb-1 relative z-10">Khối lượng Tiết kiệm</p>
        <h2 className="text-3xl font-bold tracking-tight relative z-10">{formatCurrency(totalSavingsValue)} ₫</h2>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 text-lg">Các Sổ Tiết Kiệm</h3>
          <button onClick={() => setIsAddSavingsOpen(true)} className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold active:scale-95 transition-transform"><Plus size={18} /></button>
        </div>
        
        {savings.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Chưa có sổ tiết kiệm nào.</p>}
        {savings.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {savings.map(sav => {
              const { accruedInterest, daysPassed } = computeSavingsMath(sav);
              const isSettled = sav.status !== 'active';
              return (
                <div 
                  key={sav.id} 
                  onClick={() => handleSavingsClick(sav)}
                  className={`p-4 rounded-2xl shadow-sm border ${isSettled ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-emerald-50'} relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer`}
                >
                  {isSettled && <div className="absolute top-0 right-0 bg-gray-200 text-xs px-2 py-1 font-bold text-gray-600 rounded-bl-lg">Đã tất toán</div>}
                  <h4 className="font-bold text-gray-900 text-lg mb-1">{sav.name}</h4>
                  <div className="flex space-x-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded w-fit mb-4 border border-emerald-100">
                    <span>{sav.interest_rate}%/năm</span> • <span>Kỳ hạn {sav.term_months} tháng</span>
                  </div>
                  
                  <div className="flex justify-between items-end border-t border-gray-100 pt-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Tiền gốc</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(sav.principal_amount)} ₫</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-600 mb-0.5 font-medium">Lãi tạm tính ({daysPassed} ngày)</p>
                      <p className="font-bold text-emerald-600 text-lg">+{formatCurrency(accruedInterest)} ₫</p>
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
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-4 -right-4 opacity-20"><TrendingUp size={100} /></div>
        <p className="text-purple-100 font-medium mb-1 relative z-10">Tài sản ròng đầu tư (Equity)</p>
        <h2 className="text-3xl font-bold tracking-tight relative z-10 mb-4">{formatCurrency(totalInvestmentCurrent)} ₫</h2>
        <div className="flex items-center space-x-2 text-sm font-medium border-t border-purple-500/50 pt-3 opacity-80">
          <span>Tổng giá trị thị trường:</span>
          <span>{formatCurrency(totalInvestmentMarketValue)} ₫</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 text-lg">Tài sản đang giữ</h3>
          <button onClick={() => setIsAddInvestOpen(true)} className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold active:scale-95 transition-transform"><Plus size={18} /></button>
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
              
              const diff = isRE ? 0 : (marketValue - principal); // Simplified for RE for now
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
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${isRE ? 'bg-indigo-50 border border-indigo-100' : 'bg-purple-50 border border-purple-100'}`}>{icon}</div>
                      <div>
                        <h4 className="font-bold text-gray-900 leading-tight">{inv.symbol}</h4>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5 tracking-wider">
                          {isRE ? 'Bất động sản' : `${inv.quantity} đơn vị`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-900">{formatCurrency(marketValue)} ₫</p>
                      {!isRE && (
                        <p className={`text-[10px] font-bold ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {profitStr} ({((diff / principal) * 100).toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>

                  {isRE && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-100 grid grid-cols-2 gap-2">
                       <div className="bg-red-50/50 p-2 rounded-xl">
                         <p className="text-[9px] font-bold text-red-400 uppercase mb-0.5">Vốn vay (Nợ)</p>
                         <p className="text-xs font-bold text-red-600">-{formatCurrency(loan)} ₫</p>
                       </div>
                       <div className="bg-emerald-50/50 p-2 rounded-xl text-right">
                         <p className="text-[9px] font-bold text-emerald-400 uppercase mb-0.5">Vốn gốc (Equity)</p>
                         <p className="text-xs font-bold text-emerald-600">{formatCurrency(principal)} ₫</p>
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


  return (
    <>
      <div className="p-4 safe-top pb-24 min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-4">Danh mục Tài sản</h1>
        
        {/* Custom Tabs */}
        <div className="flex bg-gray-200/60 p-1 rounded-xl mb-6">
          <button onClick={() => setActiveTab('cash')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'cash' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Tiền mặt</button>
          <button onClick={() => setActiveTab('savings')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'savings' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Tiết kiệm</button>
          <button onClick={() => setActiveTab('invest')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'invest' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>Đầu tư</button>
        </div>

        {loading ? (
           <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div></div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'cash' && renderCashTab()}
            {activeTab === 'savings' && renderSavingsTab()}
            {activeTab === 'invest' && renderInvestTab()}
          </div>
        )}
      </div>

      <AddAccountSheet isOpen={isAddAccountOpen} onClose={() => setIsAddAccountOpen(false)} onSuccess={fetchWealthData} />
      <EditAccountSheet isOpen={isEditAccountOpen} onClose={() => setIsEditAccountOpen(false)} account={selectedAccount} onSuccess={fetchWealthData} />
      <AddSavingsSheet isOpen={isAddSavingsOpen} onClose={() => setIsAddSavingsOpen(false)} onSuccess={fetchWealthData} />
      <EditSavingsSheet isOpen={isEditSavingsOpen} onClose={() => setIsEditSavingsOpen(false)} savings={selectedSavings} onSuccess={fetchWealthData} />
      <AddInvestmentSheet isOpen={isAddInvestOpen} onClose={() => setIsAddInvestOpen(false)} onSuccess={fetchWealthData} />
      <EditInvestmentSheet isOpen={isEditInvestOpen} onClose={() => setIsEditInvestOpen(false)} investment={selectedInvestment} onSuccess={fetchWealthData} />
    </>
  );
}
