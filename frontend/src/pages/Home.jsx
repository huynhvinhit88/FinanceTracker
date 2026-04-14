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

      // Fetch Transactions
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

  const totalAllLiabilities = totalDebtAccounts + loans.reduce((sum, loan) => {
    if (loan.status === 'active') return sum + (loan.remaining_principal || loan.total_amount || 0);
    return sum;
  }, 0);

  const totalAssetsGross = totalCashAndReceivable + totalSavings + totalInvestmentMarketValue;
  const globalNetWorth = totalAssetsGross - totalAllLiabilities;

  // Chart Data: Expense breakdown for current month
  const currentMonthDateStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const currentMonthExpenses = transactions.filter(tx =>
    tx.type === 'expense' && tx.date.startsWith(currentMonthDateStr)
  );

  const currentMonthIncome = transactions.filter(tx =>
    tx.type === 'income' && tx.date.startsWith(currentMonthDateStr)
  );

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
          <p className="font-semibold text-gray-900">Chuyển tiền</p>
          <p className="text-xs text-gray-500 truncate">{tx.account?.name} → {tx.to_account?.name}</p>
        </div>
      );
    }
    return (
      <div className="truncate pr-4">
        <p className="font-semibold text-gray-900 truncate">{tx.category?.name || 'Chưa phân loại'}</p>
        <p className="text-xs text-gray-500 truncate">{tx.account?.name} {tx.note && `• ${tx.note}`}</p>
      </div>
    );
  };

  return (
    <>
      <div className="p-4 safe-top pb-24">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 mt-4">
          <div>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Hôm nay, {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mt-1">Tổng quan</h1>
          </div>
        </div>

        {/* Global Net Worth Card */}
        <div className="bg-gradient-to-tr from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <p className="text-gray-300 text-sm mb-1 font-medium">Tổng tài sản ròng</p>
          <h2 className="text-3xl font-bold tracking-tight mb-4">{formatCurrency(globalNetWorth)} ₫</h2>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mb-1">Tổng tài sản</p>
              <p className="text-sm font-black text-emerald-400">+{formatCurrency(totalAssetsGross)} đ</p>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[10px] text-red-300 font-bold uppercase tracking-wider mb-1">Tổng nợ vay</p>
              <p className="text-sm font-black text-red-400">-{formatCurrency(totalAllLiabilities)} đ</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/40 text-[9px] sm:text-[10px] font-bold uppercase tracking-tight">
            <p>Tiền mặt: {formatCurrency(totalCashAndReceivable)}</p>
            <p>Tiết kiệm: {formatCurrency(totalSavings)}</p>
            <p>Đầu tư (Thị trường): {formatCurrency(totalInvestmentMarketValue)}</p>
          </div>
          
          <div className={`flex space-x-6 border-t border-gray-700 pt-4 mt-4`}>
            <div>
              <div className="flex items-center text-xs text-gray-400 mb-1">
                <TrendingUp size={12} className="text-green-400 mr-1" /> Tháng này thu
              </div>
              <p className="font-medium text-sm text-gray-200">+{formatCurrency(totalIncomeAmount)}</p>
            </div>
            <div>
              <div className="flex items-center text-xs text-gray-400 mb-1">
                <TrendingDown size={12} className="text-red-400 mr-1" /> Tháng này chi
              </div>
              <p className="font-medium text-sm text-gray-200">-{formatCurrency(totalExpenseAmount)}</p>
            </div>
          </div>
        </div>

        {/* Expense Chart Mini */}
        {chartData.length > 0 && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8 flex items-center">
            <div className="w-24 h-24 mr-4 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value) + ' đ'} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Chi tiêu Top đầu</h3>
              <div className="space-y-2">
                {chartData.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center truncate">
                      <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-medium shrink-0 ml-2">{Math.round((item.value / totalExpenseAmount) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-lg">Giao dịch gần đây</h3>
            <button onClick={() => navigate('/transactions')} className="text-blue-600 text-sm font-semibold">Xem tất cả</button>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border border-gray-100 shadow-sm mt-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowDownRight className="text-gray-400" size={32} />
              </div>
              <p className="text-gray-500 text-sm mt-2 mb-2 px-8">Chưa có giao dịch hoạt động.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const isTransfer = tx.type === 'transfer';

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleTransactionClick(tx)}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <div className="flex items-center space-x-4 pointer-events-none truncate pr-4">
                      {renderTransactionIcon(tx)}
                      <div className="min-w-0">
                        {renderTransactionDetails(tx)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 min-w-fit">
                      <p className={`font-bold ${isIncome ? 'text-green-600' : isTransfer ? 'text-gray-900' : 'text-red-500'}`}>
                        {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(tx.amount)} đ
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(tx.date).toLocaleDateString('vi-VN')}
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
        className="fixed bottom-32 right-6 w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-lg shadow-gray-400 active:scale-95 transition-transform z-40"
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
