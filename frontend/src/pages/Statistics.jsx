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

  const monthlyCategoryData = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: `T${i + 1}`,
      income: [],
      expense: []
    }));

    transactions.forEach(tx => {
      const month = new Date(tx.date).getMonth();
      const cat = categories.find(c => c.id === tx.category_id);
      const categoryName = cat ? cat.name : 'Chưa phân loại';
      const categoryIcon = cat ? cat.icon : '📌';
      
      const targetList = tx.type === 'income' ? data[month].income : data[month].expense;
      
      let catEntry = targetList.find(c => c.name === categoryName);
      if (!catEntry) {
        catEntry = { name: categoryName, icon: categoryIcon, amount: 0 };
        targetList.push(catEntry);
      }
      catEntry.amount += tx.amount;
    });

    // Sort categories by amount within each month
    data.forEach(m => {
      m.income.sort((a, b) => b.amount - a.amount);
      m.expense.sort((a, b) => b.amount - a.amount);
    });

    return data;
  }, [transactions, categories]);

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

  const handleOpenDetail = (title, data) => {
    let normalizedItems = data;
    
    // If it's the new object structure with books, sort them
    if (data && data.type === 'savings_books' && Array.isArray(data.books)) {
      normalizedItems = {
        ...data,
        books: [...data.books].sort((a, b) => new Date(a.maturity_date) - new Date(b.maturity_date))
      };
    } 
    // Fallback for direct array (if any legacy calls exist)
    else if (Array.isArray(data)) {
      normalizedItems = [...data].sort((a, b) => new Date(a.maturity_date) - new Date(b.maturity_date));
    }

    setDetailSheet({
      isOpen: true,
      title,
      items: normalizedItems
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
    <div className="p-4 lg:p-8 safe-top pb-24 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300 max-w-7xl mx-auto">
      {/* Header & Year Selector */}
      <div className="flex justify-between items-center mb-10 mt-4 px-1">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight">Thống kê</h1>
          <p className="text-xs lg:text-sm text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Báo cáo tài chính {selectedYear}</p>
        </div>
        <div className="flex items-center bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-1.5 shadow-sm">
          <button onClick={() => setSelectedYear(v => v - 1)} className="p-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-gray-400 dark:text-slate-500 transition-colors active:scale-90">
            <ChevronLeft size={20} />
          </button>
          <span className="px-6 font-black text-gray-700 dark:text-slate-200 text-base">{selectedYear}</span>
          <button onClick={() => setSelectedYear(v => v + 1)} className="p-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-gray-400 dark:text-slate-500 transition-colors active:scale-90">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* --- SECTION 1: THU NHẬP & CHI TIÊU --- */}
      <div className="mb-12">
        <div className="flex items-center mb-6 px-1">
          <div className="w-1.5 h-6 bg-emerald-500 rounded-full mr-3 shadow-sm shadow-emerald-500/40" />
          <h2 className="text-lg font-black text-gray-900 dark:text-slate-100 tracking-tight">Thu nhập & Chi tiêu</h2>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8 mb-10">
          <div className="bg-white dark:bg-slate-900 p-6 lg:p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden group transition-all">
            <div className="absolute -right-6 -top-6 w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform blur-sm lg:blur-none opacity-40 lg:opacity-100">
              <TrendingUp size={32} />
            </div>
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Tổng Thu (YTD)</p>
            <p className="text-xl lg:text-4xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalSummary.income)}<span className="text-xs ml-0.5 opacity-70">₫</span></p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 lg:p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden group transition-all">
            <div className="absolute -right-6 -top-6 w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform blur-sm lg:blur-none opacity-40 lg:opacity-100">
              <TrendingDown size={32} />
            </div>
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Tổng Chi (YTD)</p>
            <p className="text-xl lg:text-4xl font-black text-rose-600 dark:text-rose-400">{formatCurrency(totalSummary.expense)}<span className="text-xs ml-0.5 opacity-70">₫</span></p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 lg:p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden group transition-all col-span-2 lg:col-span-1">
            <div className="absolute -right-6 -top-6 w-20 h-20 bg-indigo-50 dark:bg-indigo-950/30 rounded-full flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform blur-sm lg:blur-none opacity-40 lg:opacity-100">
              <PiggyBank size={32} />
            </div>
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Tích lũy ròng (YTD)</p>
            <p className={`text-xl lg:text-4xl font-black ${totalSummary.net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {formatCurrency(totalSummary.net)}<span className="text-xs ml-0.5 opacity-70">₫</span>
            </p>
          </div>
        </div>

        {/* Cash Flow Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center">
                <BarChart size={16} className="mr-2 text-blue-500" /> Dòng tiền hàng tháng
              </h3>
              <div className="flex space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-bold text-gray-400">Thu</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="text-[9px] font-bold text-gray-400">Chi</span>
                </div>
              </div>
            </div>
            
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} 
                    tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
                  />
                  <Tooltip 
                    cursor={{ fill: 'currentColor', className: 'text-gray-50 dark:text-slate-800/20' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    formatter={(val) => [`${formatCurrency(val)} ₫`]}
                  />
                  <Bar dataKey="income" fill="#10B981" radius={[3, 3, 0, 0]} barSize={10}/>
                  <Bar dataKey="expense" fill="#FB7185" radius={[3, 3, 0, 0]} barSize={10}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center mb-6">
              <TrendingUp size={16} className="mr-2 text-indigo-500" /> Hiệu quả tích lũy
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    formatter={(val) => [`${formatCurrency(val)} ₫`]}
                  />
                  <Area type="monotone" dataKey="net" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center mb-6">
              <PieChartIcon size={16} className="mr-2 text-rose-500" /> Cơ cấu chi tiêu năm
            </h3>
            <div className="flex flex-col items-center">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px' }} formatter={(val) => [`${formatCurrency(val)} ₫`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full mt-4">
                {categoryData.slice(0, 6).map((cat, index) => (
                  <div key={cat.name} className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-gray-600 dark:text-slate-400 truncate flex-1">{cat.name}</span>
                    <span className="text-[9px] text-gray-400 dark:text-slate-500 font-medium ml-auto">
                      {Math.round((cat.value / (totalSummary.expense || 1)) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Monthly Table */}
        <div className="mt-8">
          <h3 className="text-sm font-black text-gray-900 dark:text-slate-100 mb-4 px-2 tracking-tight">Báo cáo chi tiết từng tháng</h3>
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden transition-all">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50/50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="px-5 py-4">Tháng</th>
                    <th className="px-5 py-4 text-emerald-600">Thu nhập</th>
                    <th className="px-5 py-4 text-rose-500">Chi tiêu</th>
                    <th className="px-5 py-4 text-blue-600">Tích lũy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5 text-gray-700 dark:text-slate-300 font-bold">
                  {monthlyData.filter(m => m.income > 0 || m.expense > 0).map((row, idx) => (
                    <tr 
                      key={row.month} 
                      onClick={() => handleOpenDetail(`Chi tiết ${row.month}`, { 
                        type: 'monthly_category', 
                        income: monthlyCategoryData[idx].income, 
                        expense: monthlyCategoryData[idx].expense 
                      })}
                      className="hover:bg-blue-50/50 dark:hover:bg-indigo-950/20 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <td className="px-5 py-5 font-black dark:text-slate-100 flex items-center">
                        {row.month}
                        <ChevronRightIcon size={12} className="ml-1 opacity-20" />
                      </td>
                      <td className="px-5 py-5 text-emerald-600 dark:text-emerald-400">{formatCurrency(row.income)}</td>
                      <td className="px-5 py-5 text-rose-500 dark:text-rose-400">{formatCurrency(row.expense)}</td>
                      <td className={`px-5 py-5 ${row.net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-500 dark:text-orange-400'}`}>
                        {row.net > 0 ? '+' : ''}{formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 2: TÀI SẢN & TIẾT KIỆM --- */}
      <div className="mb-12">
        <div className="flex items-center mb-6 px-1">
          <div className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3 shadow-sm shadow-indigo-500/40" />
          <h2 className="text-xl font-black text-gray-900 dark:text-slate-100 tracking-tight">Tài sản & Tiết kiệm</h2>
        </div>

        {/* Wealth Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-8 mb-10">
          <div className="bg-white dark:bg-slate-900 p-8 lg:p-12 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm shadow-indigo-500/5 flex flex-col justify-center">
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center">
              <Wallet size={16} className="mr-2 text-indigo-500" /> Tổng vốn gửi tiết kiệm
            </p>
            <p className="text-3xl lg:text-5xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
              {formatCurrency(activeSavingsAnalysis.totalPrincipal)}<span className="text-base lg:text-lg ml-1 opacity-50">₫</span>
            </p>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 lg:p-12 rounded-[2.5rem] border border-transparent shadow-xl shadow-indigo-500/20 flex flex-col justify-center">
            <p className="text-[10px] lg:text-xs font-bold text-white/70 uppercase tracking-widest mb-3 flex items-center">
              <TrendingUp size={16} className="mr-2" /> Tổng lãi dự kiến (Tất cả sổ)
            </p>
            <p className="text-3xl lg:text-5xl font-black text-white tracking-tight">
              +{formatCurrency(activeSavingsAnalysis.totalInterest)}<span className="text-base lg:text-lg ml-1 opacity-50">₫</span>
            </p>
          </div>
        </div>

        {/* Savings Components Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          {/* Category Distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
            <div className="p-6">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6 text-sm">
                <PieChartIcon size={16} className="mr-2 text-indigo-500" /> Cơ cấu theo Hạng mục
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  {activeSavingsAnalysis.byCategory.map((cat, idx) => (
                    <div 
                      key={cat.name} 
                      onClick={() => handleOpenDetail(`Sổ tiết kiệm: ${cat.name}`, { type: 'savings_books', books: cat.books })}
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

          {/* Account Distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
            <div className="p-6">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6 text-sm">
                <Landmark size={16} className="mr-2 text-blue-500" /> Cơ cấu theo Tài khoản
              </h3>
              <div className="space-y-4">
                {activeSavingsAnalysis.byAccount.map((acc, idx) => (
                  <div 
                    key={acc.name} 
                    onClick={() => handleOpenDetail(`Tài khoản: ${acc.name}`, { type: 'savings_books', books: acc.books })}
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
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6 text-sm">
                <Clock size={16} className="mr-2 text-orange-500" /> Lịch trình nhận tiền (Gốc + Lãi)
              </h3>
              
              {/* Timeline Chart */}
              <div className="h-40 w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeSavingsAnalysis.timeline} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
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
              <div className="space-y-3">
                {activeSavingsAnalysis.timeline.map((item, idx) => (
                  <div 
                    key={item.label} 
                    onClick={() => handleOpenDetail(`Đáo hạn: ${item.label}`, { type: 'savings_books', books: item.books })}
                    className="flex items-center p-4 rounded-3xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30"
                  >
                    <div className="w-12 text-center border-r border-gray-200 dark:border-white/5 mr-4">
                      <p className="text-[8px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-tighter">Tháng</p>
                      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{item.label}</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-black text-gray-900 dark:text-slate-100">{formatCurrency(item.principal + item.interest)}₫</p>
                        <ChevronRightIcon size={14} className="text-gray-300 opacity-50" />
                      </div>
                      <div className="flex justify-between mt-1">
                        <p className="text-[9px] font-medium text-gray-500">Gốc: {formatCurrency(item.principal)}</p>
                        <p className="text-[9px] text-emerald-600 font-bold">Lãi: +{formatCurrency(item.interest)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail BottomSheet Component */}
      <BottomSheet 
        isOpen={detailSheet.isOpen} 
        onClose={() => setDetailSheet({ ...detailSheet, isOpen: false })}
        title={detailSheet.title}
      >
        <div className="pb-10">
          {/* Monthly Category Detail View */}
          {detailSheet.items.type === 'monthly_category' && (
            <div className="space-y-6">
              {/* Income Section */}
              {detailSheet.items.income.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 px-1">Thu nhập</h4>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5 shadow-sm">
                    {detailSheet.items.income.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-lg">{cat.icon}</div>
                          <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{cat.name}</span>
                        </div>
                        <span className="text-sm font-black text-emerald-600">+{formatCurrency(cat.amount)}₫</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense Section */}
              {detailSheet.items.expense.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 px-1">Chi tiêu</h4>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5 shadow-sm">
                    {detailSheet.items.expense.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-lg">{cat.icon}</div>
                          <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{cat.name}</span>
                        </div>
                        <span className="text-sm font-black text-rose-500">{formatCurrency(cat.amount)}₫</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {detailSheet.items.income.length === 0 && detailSheet.items.expense.length === 0 && (
                <div className="text-center py-10 text-gray-400 italic">Không có giao dịch nào trong tháng này</div>
              )}
            </div>
          )}

          {/* Savings Books Detail View */}
          {detailSheet.items.type === 'savings_books' && (
            <div className="space-y-4">
              {detailSheet.items.books.map((book, idx) => (
                <div key={book.id || idx} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-transparent dark:border-white/5">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-gray-900 dark:text-slate-100 text-sm">{book.name}</h4>
                    <div className="bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded-lg text-[9px] font-black text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                      {book.interest_rate}% / năm
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tiền gốc</p>
                      <p className="font-black text-gray-900 dark:text-slate-100">{formatCurrency(book.principal_amount)}₫</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Lãi nhận được</p>
                      <p className="font-black text-emerald-600">+{formatCurrency(book.expected_interest)}₫</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Ngày gửi</p>
                      <p className="font-bold text-gray-600 dark:text-slate-400">{new Date(book.start_date).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Ngày đáo hạn</p>
                      <p className="font-bold text-indigo-600 dark:text-indigo-400">{new Date(book.maturity_date).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                </div>
              ))}
              {detailSheet.items.books.length === 0 && (
                <div className="text-center py-10 text-gray-400 italic">Không có dữ liệu sổ tiết kiệm</div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
