import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, PiggyBank, Calendar, 
  ChevronLeft, ChevronRight, Filter, Download,
  Wallet, PieChart as PieChartIcon, Clock, ChevronRight as ChevronRightIcon,
  Info, Landmark
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { BottomSheet } from '../components/ui/BottomSheet';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function Statistics() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savingsBooks, setSavingsBooks] = useState([]);
  const [categories, setCategories] = useState([]);

  // State for detail sheet
  const [detailSheet, setDetailSheet] = useState({ isOpen: false, title: '', items: [] });

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

  // --- SAVINGS SPECIFIC AGGREGATION ---

  const activeSavingsAnalysis = useMemo(() => {
    const activeBooks = savingsBooks.filter(b => b.status === 'active');
    
    // 1. Calculate Interest for each book
    const enrichedBooks = activeBooks.map(b => {
      const interest = Math.round(b.principal_amount * (b.interest_rate / 100) * ((b.term_months || 0) / 12));
      return { ...b, expected_interest: interest };
    });

    const totalPrincipal = enrichedBooks.reduce((sum, b) => sum + b.principal_amount, 0);
    const totalInterest = enrichedBooks.reduce((sum, b) => sum + b.expected_interest, 0);

    // 2. By Category
    const byCategoryMap = {};
    enrichedBooks.forEach(b => {
      const catId = b.category_id || 'unclassified';
      if (!byCategoryMap[catId]) {
        const cat = categories.find(c => c.id === catId);
        byCategoryMap[catId] = {
          name: cat ? cat.name : 'Khác',
          icon: cat ? cat.icon : '📌',
          amount: 0,
          interest: 0,
          books: []
        };
      }
      byCategoryMap[catId].amount += b.principal_amount;
      byCategoryMap[catId].interest += b.expected_interest;
      byCategoryMap[catId].books.push(b);
    });

    const byCategory = Object.values(byCategoryMap).sort((a, b) => b.amount - a.amount);

    // 3. By Source Account
    const byAccountMap = {};
    enrichedBooks.forEach(b => {
      const accId = b.account_id || 'unclassified';
      if (!byAccountMap[accId]) {
        const acc = accounts.find(a => a.id === accId);
        byAccountMap[accId] = {
          name: acc ? acc.name : 'Không rõ source',
          amount: 0,
          interest: 0,
          books: []
        };
      }
      byAccountMap[accId].amount += b.principal_amount;
      byAccountMap[accId].interest += b.expected_interest;
      byAccountMap[accId].books.push(b);
    });

    const byAccount = Object.values(byAccountMap).sort((a, b) => b.amount - a.amount);

    // 4. Maturity Schedule (Timeline)
    const maturityMap = {};
    enrichedBooks.forEach(b => {
      if (!b.maturity_date) return;
      const date = new Date(b.maturity_date);
      const mmYyyy = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
      const sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!maturityMap[sortKey]) {
        maturityMap[sortKey] = {
          label: mmYyyy,
          principal: 0,
          interest: 0,
          books: []
        };
      }
      maturityMap[sortKey].principal += b.principal_amount;
      maturityMap[sortKey].interest += b.expected_interest;
      maturityMap[sortKey].books.push(b);
    });

    const timeline = Object.entries(maturityMap)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, val]) => val);

    return {
      totalPrincipal,
      totalInterest,
      byCategory,
      byAccount,
      timeline
    };
  }, [savingsBooks, categories, accounts]);

  const handleOpenDetail = (title, items) => {
    setDetailSheet({
      isOpen: true,
      title,
      items: items.sort((a, b) => new Date(a.maturity_date) - new Date(b.maturity_date))
    });
  };

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

      {/* --- NEW SAVINGS ANALYSIS SECTION --- */}
      <div className="space-y-6">
        <h2 className="text-lg font-black text-gray-900 dark:text-slate-100 px-2 flex items-center">
          <PiggyBank className="mr-2 text-indigo-500" size={24} />
          Chi tiết Sổ tiết kiệm hiện có
        </h2>

        {/* Savings Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center">
              <Wallet size={12} className="mr-1" /> Tổng vốn gửi
            </p>
            <p className="text-xl font-black text-gray-900 dark:text-slate-100">
              {formatCurrency(activeSavingsAnalysis.totalPrincipal)}<span className="text-xs ml-0.5">₫</span>
            </p>
          </div>
          <div className="bg-indigo-600 dark:bg-indigo-600/20 p-5 rounded-[2rem] border border-transparent dark:border-indigo-500/30 shadow-sm">
            <p className="text-[10px] font-bold text-white/70 dark:text-indigo-400 uppercase tracking-widest mb-1 flex items-center">
              <TrendingUp size={12} className="mr-1" /> Lãi dự kiến (Tất cả)
            </p>
            <p className="text-xl font-black text-white dark:text-indigo-400">
              +{formatCurrency(activeSavingsAnalysis.totalInterest)}<span className="text-xs ml-0.5">₫</span>
            </p>
          </div>
        </div>

        {/* Analysis Tables & Mini Charts */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
          <div className="p-6">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6">
              <PieChartIcon size={18} className="mr-2 text-indigo-500" />
              Cơ cấu theo Hạng mục
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                {activeSavingsAnalysis.byCategory.map((cat, idx) => (
                  <div 
                    key={cat.name} 
                    onClick={() => handleOpenDetail(`Sổ tiết kiệm: ${cat.name}`, cat.books)}
                    className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-white/5"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-lg">{cat.icon}</div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{cat.name}</p>
                        <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500">{Math.round((cat.amount / activeSavingsAnalysis.totalPrincipal) * 100)}% tổng vốn</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center">
                      <div className="mr-3">
                        <p className="text-sm font-black text-gray-900 dark:text-slate-100">{formatCurrency(cat.amount)}₫</p>
                        <p className="text-[10px] font-bold text-emerald-500">+{formatCurrency(cat.interest)}₫ lãi</p>
                      </div>
                      <ChevronRightIcon size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-48 hidden md:block">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activeSavingsAnalysis.byCategory}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="amount"
                    >
                      {activeSavingsAnalysis.byCategory.map((_, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
          <div className="p-6">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6">
              <Landmark size={18} className="mr-2 text-blue-500" />
              Cơ cấu theo Tài khoản
            </h3>
            <div className="space-y-4">
              {activeSavingsAnalysis.byAccount.map((acc, idx) => (
                <div 
                  key={acc.name} 
                  onClick={() => handleOpenDetail(`Tài khoản: ${acc.name}`, acc.books)}
                  className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-white/5"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <Landmark size={20} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{acc.name}</p>
                      <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500">{Math.round((acc.amount / activeSavingsAnalysis.totalPrincipal) * 100)}% tổng vốn</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center">
                    <div className="mr-3">
                      <p className="text-sm font-black text-gray-900 dark:text-slate-100">{formatCurrency(acc.amount)}₫</p>
                      <p className="text-[10px] font-bold text-emerald-500">+{formatCurrency(acc.interest)}₫ lãi</p>
                    </div>
                    <ChevronRightIcon size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Maturity Schedule Timeline */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
          <div className="p-6">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6">
              <Clock size={18} className="mr-2 text-orange-500" />
              Lịch trình nhận tiền (Gốc + Lãi)
            </h3>
            
            {/* Timeline Chart */}
            <div className="h-40 w-full mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeSavingsAnalysis.timeline} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    formatter={(val) => [`${formatCurrency(val)} ₫`]}
                  />
                  <Bar dataKey="principal" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={15} stackId="a" />
                  <Bar dataKey="interest" fill="#10B981" radius={[4, 4, 0, 0]} barSize={15} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center space-x-6 mt-2">
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-[9px] font-bold text-gray-400">Gốc</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-bold text-gray-400">Lãi dự kiến</span>
                </div>
              </div>
            </div>

            {/* Timeline List */}
            <div className="space-y-4">
              {activeSavingsAnalysis.timeline.map((item, idx) => (
                <div 
                  key={item.label} 
                  onClick={() => handleOpenDetail(`Đáo hạn: ${item.label}`, item.books)}
                  className="flex items-center p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <div className="w-12 text-center border-r border-gray-200 dark:border-white/5 mr-4">
                    <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase">Tháng</p>
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{item.label}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-black text-gray-900 dark:text-slate-100">{formatCurrency(item.principal + item.interest)}₫</p>
                      <ChevronRightIcon size={14} className="text-gray-300" />
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-[10px] text-gray-500">Gốc: {formatCurrency(item.principal)}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">Lãi: +{formatCurrency(item.interest)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detail BottomSheet */}
      <BottomSheet 
        isOpen={detailSheet.isOpen} 
        onClose={() => setDetailSheet({ ...detailSheet, isOpen: false })}
        title={detailSheet.title}
      >
        <div className="space-y-4 pb-8">
          {detailSheet.items.map((book, idx) => (
            <div key={book.id || idx} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-transparent dark:border-white/5">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-bold text-gray-900 dark:text-slate-100">{book.name}</h4>
                <div className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-[10px] font-black text-blue-600 dark:text-blue-400">
                  {book.interest_rate}% / năm
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tiền gốc</p>
                  <p className="font-black text-gray-900 dark:text-slate-100">{formatCurrency(book.principal_amount)}₫</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Lãi nhận được</p>
                  <p className="font-black text-emerald-600">+{formatCurrency(book.expected_interest)}₫</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ngày gửi</p>
                  <p className="font-bold text-gray-700 dark:text-slate-300">{new Date(book.start_date).toLocaleDateString('vi-VN')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ngày đáo hạn</p>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">{new Date(book.maturity_date).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
            </div>
          ))}
          {detailSheet.items.length === 0 && (
            <div className="text-center py-8 text-gray-400 italic">Không có dữ liệu sổ tiết kiệm</div>
          )}
        </div>
      </BottomSheet>

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
