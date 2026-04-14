import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, PiggyBank, Calendar, 
  ChevronLeft, ChevronRight, Filter, Download
} from 'lucide-react';
import { formatCurrency } from '../utils/format';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function Statistics() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savingsBooks, setSavingsBooks] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchData();
  }, [user, selectedYear]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startOfYear = `${selectedYear}-01-01T00:00:00.000Z`;
      const endOfYear = `${selectedYear}-12-31T23:59:59.999Z`;

      const allTxRaw = await db.transactions
        .filter(tx => tx.date >= startOfYear && tx.date <= endOfYear)
        .toArray();

      const accData = await db.accounts.toArray();
      const savData = await db.savings.toArray();
      const catData = await db.categories.toArray();

      // Sort transactions by date ascending
      allTxRaw.sort((a, b) => new Date(a.date) - new Date(b.date));

      setTransactions(allTxRaw);
      setAccounts(accData);
      setSavingsBooks(savData);
      setCategories(catData);
    } catch (err) {
      console.error('Error fetching statistics data:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- DATA AGGREGATION ---

  const monthlyData = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: `T${i + 1}`,
      income: 0,
      expense: 0,
      savings: 0,
      net: 0
    }));

    transactions.forEach(tx => {
      const month = new Date(tx.date).getMonth();
      if (tx.type === 'income') data[month].income += tx.amount;
      else if (tx.type === 'expense') data[month].expense += tx.amount;
    });

    // Net savings calculation for each month
    data.forEach(m => {
      m.net = m.income - m.expense;
    });

    return data;
  }, [transactions]);

  const categoryData = useMemo(() => {
    const expenseMap = {};
    transactions
      .filter(tx => tx.type === 'expense')
      .forEach(tx => {
        const cat = categories.find(c => c.id === tx.category_id);
        const name = cat ? cat.name : 'Chưa phân loại';
        expenseMap[name] = (expenseMap[name] || 0) + tx.amount;
      });

    return Object.entries(expenseMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, categories]);

  const totalSummary = useMemo(() => {
    const income = transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
    const expense = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    
    // Total current savings (current balance, not flow)
    const accSavings = accounts.filter(a => a.sub_type === 'savings').reduce((s, a) => s + (a.balance || 0), 0);
    const bookSavings = savingsBooks.filter(b => b.status === 'active').reduce((s, b) => s + (b.principal_amount || 0), 0);

    return {
      income,
      expense,
      net: income - expense,
      totalSavingsBalance: accSavings + bookSavings
    };
  }, [transactions, accounts, savingsBooks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-blue-200 dark:border-slate-800 border-t-blue-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 safe-top pb-24 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header & Year Selector */}
      <div className="flex justify-between items-center mb-6 mt-4 px-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">Thống kê</h1>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Báo cáo tài chính năm {selectedYear}</p>
        </div>
        <div className="flex items-center bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl p-1 shadow-sm transition-colors">
          <button onClick={() => setSelectedYear(v => v - 1)} className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400 dark:text-slate-500">
            <ChevronLeft size={18} />
          </button>
          <span className="px-4 font-bold text-gray-700 dark:text-slate-200 text-sm">{selectedYear}</span>
          <button onClick={() => setSelectedYear(v => v + 1)} className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400 dark:text-slate-500">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute -right-4 -top-4 w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center text-emerald-500">
            <TrendingUp size={20} />
          </div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tổng Thu</p>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalSummary.income)}<span className="text-[10px] ml-0.5">₫</span></p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute -right-4 -top-4 w-12 h-12 bg-red-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center text-red-500 dark:text-rose-400">
            <TrendingDown size={20} />
          </div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tổng Chi</p>
          <p className="text-lg font-black text-red-600 dark:text-rose-400">{formatCurrency(totalSummary.expense)}<span className="text-[10px] ml-0.5">₫</span></p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute -right-4 -top-4 w-12 h-12 bg-blue-50 dark:bg-indigo-950/30 rounded-full flex items-center justify-center text-blue-500 dark:text-indigo-400">
            <PiggyBank size={20} />
          </div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tích lũy năm</p>
          <p className={`text-lg font-black ${totalSummary.net >= 0 ? 'text-blue-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {formatCurrency(totalSummary.net)}<span className="text-[10px] ml-0.5">₫</span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute -right-4 -top-4 w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 rounded-full flex items-center justify-center text-indigo-500 dark:text-indigo-400">
            <Calendar size={20} />
          </div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tổng Tiết kiệm</p>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(totalSummary.totalSavingsBalance)}<span className="text-[10px] ml-0.5">₫</span></p>
        </div>
      </div>

      {/* Main Bar Chart: Income vs Expense */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm mb-6 transition-colors">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 border-l-4 border-blue-500 pl-3">Dòng tiền hàng tháng</h3>
          <div className="flex space-x-2">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">Thu</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">Chi</span>
            </div>
          </div>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-800" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
              />
              <Tooltip 
                cursor={{ fill: 'currentColor', className: 'text-gray-50 dark:text-slate-800/50' }}
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                  fontSize: '12px',
                  backgroundColor: 'var(--tw-bg-opacity, #ffffff)',
                  color: 'var(--tw-text-opacity, #1e293b)'
                }}
                className="dark:!bg-slate-800 dark:!text-slate-100"
                itemStyle={{ fontWeight: 'bold' }}
                formatter={(val) => [`${formatCurrency(val)} ₫`]}
              />
              <Bar 
                dataKey="income" 
                fill="#10B981" 
                radius={[4, 4, 0, 0]} 
                barSize={12}
                activeBar={<Cell fill="#059669" />}
              />
              <Bar 
                dataKey="expense" 
                fill="#F87171" 
                radius={[4, 4, 0, 0]} 
                barSize={12}
                activeBar={<Cell fill="#EF4444" />}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart: Categories & Area Chart: Savings Trend Side by Side / Stacked */}
      <div className="grid grid-cols-1 gap-6">
        {/* Expense Category Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 border-l-4 border-red-500 pl-3 mb-6">Cơ cấu chi tiêu</h3>
          <div className="flex flex-col items-center">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    formatter={(val) => [`${formatCurrency(val)} ₫`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full mt-2">
              {categoryData.slice(0, 6).map((cat, index) => (
                <div key={cat.name} className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-bold text-gray-600 dark:text-slate-400 truncate">{cat.name}</span>
                  <span className="text-[9px] text-gray-400 dark:text-slate-500 font-medium ml-auto">
                    {Math.round((cat.value / (totalSummary.expense || 1)) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Savings Progress */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 border-l-4 border-indigo-500 pl-3 mb-6">Hiệu quả tích lũy</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-800" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                formatter={(val) => [`${formatCurrency(val)} ₫`]}
              />
                <Area type="monotone" dataKey="net" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bonus Table: Detailed Monthly Breakdown */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-4 px-2">Báo cáo chi tiết từng tháng</h3>
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                <tr>
                  <th className="px-4 py-4">Tháng</th>
                  <th className="px-4 py-4 text-emerald-600">Thu nhập</th>
                  <th className="px-4 py-4 text-red-500">Chi tiêu</th>
                  <th className="px-4 py-4 text-blue-600">Tích lũy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5 text-gray-700 dark:text-slate-300 font-bold">
                {monthlyData.filter(m => m.income > 0 || m.expense > 0).map((row) => (
                  <tr key={row.month} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-4 py-4 font-black dark:text-slate-100">{row.month}</td>
                    <td className="px-4 py-4 text-emerald-600 dark:text-emerald-400">{formatCurrency(row.income)}</td>
                    <td className="px-4 py-4 text-red-500 dark:text-rose-400">{formatCurrency(row.expense)}</td>
                    <td className={`px-4 py-4 ${row.net >= 0 ? 'text-blue-600 dark:text-indigo-400' : 'text-orange-500 dark:text-orange-400'}`}>
                      {row.net > 0 ? '+' : ''}{formatCurrency(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {monthlyData.filter(m => m.income > 0 || m.expense > 0).length === 0 && (
            <div className="p-8 text-center text-gray-400 dark:text-slate-600 italic">
              Không có dữ liệu giao dịch trong năm {selectedYear}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
