import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { Plus, ArrowDownRight, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { AddTransactionSheet } from '../components/transactions/AddTransactionSheet';
import { EditTransactionSheet } from '../components/transactions/EditTransactionSheet';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [thisMonthTransactions, setThisMonthTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savings, setSavings] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loans, setLoans] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

      const accData = await db.accounts.toArray();
      setAccounts(accData);

      const savData = await db.savings.toArray();
      setSavings(savData);

      const invData = await db.investments.toArray();
      setInvestments(invData);

      const loanData = await db.loans.toArray();
      setLoans(loanData);

      const goalData = await db.goals.toArray();
      setGoals(goalData);

      const catData = await db.categories.toArray();

      // Fetch Recent Transactions for List (Limit 20)
      const txRaw = await db.transactions
        .orderBy('date')
        .reverse()
        .limit(20)
        .toArray();

      const txData = txRaw.map(tx => ({
        ...tx,
        account: accData.find(a => a.id === tx.account_id),
        to_account: accData.find(a => a.id === tx.to_account_id),
        category: catData.find(c => c.id === tx.category_id)
      }));

      setTransactions(txData);

      // Fetch ALL transactions for the current month for summary/chart
      const monthTxRaw = await db.transactions
        .filter(tx => tx.date.startsWith(currentMonthStr))
        .toArray();
      
      const monthTxData = monthTxRaw.map(tx => ({
        ...tx,
        category: catData.find(c => c.id === tx.category_id)
      }));
      
      setThisMonthTransactions(monthTxData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionClick = (tx) => {
    setSelectedTransaction(tx);
    setIsEditSheetOpen(true);
  };

  // Computations
  const totalCashAndReceivable = accounts.reduce((sum, acc) => {
    if (acc.sub_type === 'debt') return sum; // Debt accounts separate
    return sum + (acc.balance || 0);
  }, 0);

  const totalDebtAccounts = accounts.reduce((sum, acc) => {
    if (acc.sub_type === 'debt') return sum + (acc.balance || 0);
    return sum;
  }, 0);

  const totalSavings = savings.reduce((sum, sav) => {
    if (sav.status !== 'active') return sum;
    return sum + (sav.principal_amount || 0);
  }, 0);

  const totalInvestmentMarketValue = investments.reduce((sum, inv) => {
    return sum + ((inv.current_price || 0) * (inv.type === 'real_estate' ? 1 : (inv.quantity || 1)));
  }, 0);

  const totalInvestmentsNet = investments.reduce((sum, inv) => {
    const marketVal = (inv.current_price || 0) * (inv.type === 'real_estate' ? 1 : (inv.quantity || 1));
    const debt = inv.loan_amount || 0;
    return sum + (marketVal - debt);
  }, 0);

  // Tổng nợ = Nợ thẻ + Nợ trong bảng Loans + Nợ trong Investments (nếu chưa được link vào bảng Loans)
  const totalAllLiabilities = totalDebtAccounts + loans.reduce((sum, loan) => {
    if (loan.status === 'active') return sum + (loan.remaining_principal || loan.total_amount || 0);
    return sum;
  }, 0) + investments.reduce((sum, inv) => {
    // Nếu đầu tư có nợ nhưng KHÔNG có khoản vay nào trong bảng Loans gắn với nó (tránh đếm trùng)
    const hasLinkedLoan = loans.some(l => l.linked_investment_id === inv.id);
    if (!hasLinkedLoan && inv.loan_amount > 0) return sum + inv.loan_amount;
    return sum;
  }, 0);

  const totalAssetsGross = totalCashAndReceivable + totalSavings + totalInvestmentMarketValue;
  const globalNetWorth = totalAssetsGross - totalAllLiabilities;

  // Chart Data: Expense breakdown for current month
  const currentMonthExpenses = thisMonthTransactions.filter(tx => tx.type === 'expense');
  const currentMonthIncome = thisMonthTransactions.filter(tx => tx.type === 'income');

  const totalExpenseAmount = currentMonthExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncomeAmount = currentMonthIncome.reduce((sum, tx) => sum + tx.amount, 0);

  const chartData = Object.values(currentMonthExpenses.reduce((acc, tx) => {
    const catName = tx.category?.name || 'Chưa phân loại';
    if (!acc[catName]) {
      acc[catName] = { name: catName, value: 0, color: tx.category?.color_hex || '#9CA3AF' };
    }
    acc[catName].value += tx.amount;
    return acc;
  }, {}));

  // Sort chart data largest first
  chartData.sort((a, b) => b.value - a.value);

  const renderTransactionIcon = (tx) => {
    if (tx.type === 'transfer') {
      return (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
          <ArrowRightLeft size={20} />
        </div>
      );
    }
    return (
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white"
        style={{ backgroundColor: tx.category?.color_hex || '#9CA3AF' }}
      >
        <span className="text-xl">{tx.category?.icon || (tx.type === 'income' ? '💰' : '💸')}</span>
      </div>
    );
  };

  const renderTransactionDetails = (tx) => {
    if (tx.type === 'transfer') {
      return (
        <div className="truncate pr-4">
          <p className="font-semibold text-gray-900 dark:text-slate-100">Chuyển tiền</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{tx.account?.name} → {tx.to_account?.name}</p>
        </div>
      );
    }
    return (
      <div className="truncate pr-4">
        <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{tx.category?.name || 'Chưa phân loại'}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{tx.account?.name} {tx.note && `• ${tx.note}`}</p>
      </div>
    );
  };

  return (
    <>
      <div className="p-4 lg:p-8 safe-top pb-24 transition-colors duration-300 dark:bg-slate-950 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 mt-4 px-1">
          <div>
            <p className="text-sm text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest">Hôm nay, {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            <h1 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight mt-1">Tổng quan</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          <div className="space-y-6">
            {/* Global Net Worth Card */}
            <div className="bg-gradient-to-tr from-gray-900 to-gray-800 dark:from-indigo-950 dark:to-slate-900 rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 text-white shadow-xl lg:shadow-2xl relative overflow-hidden transition-all duration-500 border border-white/5 h-full flex flex-col justify-center">
              <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
              <p className="text-gray-300 dark:text-slate-400 text-sm lg:text-base mb-1 font-medium">Tổng tài sản ròng</p>
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-6 tabular-nums">{formatCurrency(globalNetWorth)} ₫</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 dark:bg-indigo-900/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <p className="text-[10px] lg:text-xs text-emerald-300 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">Tổng tài sản (+)</p>
                  <p className="text-sm lg:text-lg font-black text-emerald-400 tabular-nums">+{formatCurrency(totalAssetsGross)} đ</p>
                </div>
                <div className="bg-white/5 dark:bg-rose-900/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <p className="text-[10px] lg:text-xs text-red-300 dark:text-rose-400 font-bold uppercase tracking-wider mb-1">Tổng nợ vay (-)</p>
                   <p className="text-sm lg:text-lg font-black text-red-400 dark:text-rose-400 tabular-nums">-{formatCurrency(totalAllLiabilities)} đ</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-white/40 text-[10px] font-bold uppercase tracking-tight mb-8">
                <p>Tiền mặt: {formatCurrency(totalCashAndReceivable)}</p>
                <p>Tiết kiệm: {formatCurrency(totalSavings)}</p>
                <p>Đầu tư (Ròng): {formatCurrency(totalInvestmentsNet)}</p>
              </div>
              
              <div className={`flex space-x-8 border-t border-gray-700 dark:border-white/10 pt-6 mt-2`}>
                <div>
                  <div className="flex items-center text-xs text-gray-400 dark:text-slate-500 mb-1 font-bold uppercase tracking-widest">
                    <TrendingUp size={14} className="text-green-400 dark:text-emerald-400 mr-2" /> Tháng này thu
                  </div>
                   <p className="font-bold text-lg text-white dark:text-emerald-400 tabular-nums">+{formatCurrency(totalIncomeAmount)}</p>
                </div>
                <div>
                  <div className="flex items-center text-xs text-gray-400 dark:text-slate-500 mb-1 font-bold uppercase tracking-widest">
                    <TrendingDown size={14} className="text-red-400 dark:text-rose-400 mr-2" /> Tháng này chi
                  </div>
                   <p className="font-bold text-lg text-white dark:text-rose-400 tabular-nums">-{formatCurrency(totalExpenseAmount)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Expense Chart Mini */}
            {chartData.length > 0 ? (
              <div className="bg-white dark:bg-slate-900 p-8 lg:p-10 rounded-2xl lg:rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/5 h-full flex flex-col transition-colors">
                <h3 className="text-sm lg:text-base font-black text-gray-900 dark:text-slate-100 uppercase tracking-widest mb-8 text-center lg:text-left pt-2">Cơ cấu chi tiêu</h3>
                <div className="flex-1 flex flex-col lg:flex-row items-center justify-center">
                  <div className="w-48 h-48 lg:w-56 lg:h-56 shrink-0 mb-6 lg:mb-0 lg:mr-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                          formatter={(value) => formatCurrency(value) + ' đ'} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-4">
                    {chartData.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs lg:text-sm font-bold">
                          <div className="flex items-center truncate">
                            <div className="w-2.5 h-2.5 rounded-full mr-3 shrink-0" style={{ backgroundColor: item.color }}></div>
                            <span className="text-gray-600 dark:text-slate-400 truncate">{item.name}</span>
                          </div>
                          <span className="text-gray-900 dark:text-slate-200 ml-4 font-black">{Math.round((item.value / totalExpenseAmount) * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-50 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(item.value / totalExpenseAmount) * 100}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/5 h-full flex flex-col items-center justify-center text-center">
                 <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
                   <TrendingUp size={32} className="text-gray-300" />
                 </div>
                 <p className="text-sm font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest pr-2 pt-2">Chưa có dữ liệu chi tiêu</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions Section */}
        <div className="mt-12 lg:mt-16">
          <div className="flex items-center justify-between mb-8 px-1">
            <h3 className="font-black text-gray-900 dark:text-slate-100 text-xl lg:text-2xl tracking-tight">Giao dịch gần đây</h3>
            <button 
              onClick={() => navigate('/transactions')} 
              className="px-6 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
            >
              Xem tất cả
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm mt-4">
              <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <ArrowDownRight className="text-gray-300 dark:text-slate-600" size={40} />
              </div>
              <p className="text-gray-400 dark:text-slate-500 text-sm font-bold uppercase tracking-widest">Chưa có giao dịch hoạt động</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {transactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const isTransfer = tx.type === 'transfer';

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleTransactionClick(tx)}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 flex items-center justify-between active:scale-[0.98] lg:hover:shadow-md lg:hover:border-indigo-100 dark:lg:hover:border-indigo-900 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-5 pointer-events-none truncate pr-4">
                      {renderTransactionIcon(tx)}
                      <div className="min-w-0">
                        {renderTransactionDetails(tx)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 min-w-fit">
                       <p className={`font-black text-base lg:text-lg tabular-nums ${isIncome ? 'text-green-600 dark:text-emerald-400' : isTransfer ? 'text-gray-900 dark:text-slate-100' : 'text-red-500 dark:text-rose-400'}`}>
                        {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(tx.amount)} đ
                      </p>
                      <p className="text-[10px] lg:text-xs text-gray-400 dark:text-slate-500 font-medium">
                        {new Date(tx.date).toLocaleDateString('vi-VN')} • {new Date(tx.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB - Floating Action Button for Transactions */}
      <button
        onClick={() => setIsAddSheetOpen(true)}
        className="fixed bottom-32 right-6 w-14 h-14 bg-gray-900 dark:bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-gray-400 dark:shadow-indigo-950 active:scale-95 transition-all z-40"
      >
        <Plus size={28} />
      </button>

      <AddTransactionSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        onSuccess={() => {
          setLoading(true);
          fetchDashboardData();
        }}
      />

      <EditTransactionSheet
        isOpen={isEditSheetOpen}
        onClose={() => {
          setIsEditSheetOpen(false);
          setTimeout(() => setSelectedTransaction(null), 300);
        }}
        transaction={selectedTransaction}
        onSuccess={() => {
          setLoading(true);
          fetchDashboardData();
        }}
      />
    </>
  );
}
