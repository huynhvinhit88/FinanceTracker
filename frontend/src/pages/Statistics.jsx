import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import {
  TrendingUp, TrendingDown, PiggyBank,
  ChevronLeft, ChevronRight,
  PieChart as PieChartIcon, ChevronRight as ChevronRightIcon,
  Info, ArrowLeftRight, AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useGlobalRefresh } from '../hooks/useGlobalRefresh';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function Statistics() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [savingsMap, setSavingsMap] = useState({});
  const [editingSavingsMonth, setEditingSavingsMonth] = useState(null);
  const [editSavingsValue, setEditSavingsValue] = useState('');

  // State for detail sheet
  const [detailSheet, setDetailSheet] = useState({ isOpen: false, title: '', items: [] });

  useEffect(() => {
    fetchData();
  }, [user, selectedYear]);

  // Tự fetch lại khi thêm giao dịch từ nút "+" toàn cục
  useGlobalRefresh(() => fetchData());

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startOfYear = `${selectedYear}-01-01T00:00:00.000Z`;
      const endOfYear = `${selectedYear}-12-31T23:59:59.999Z`;

      const allTxRaw = await db.transactions
        .filter(tx => tx.date >= startOfYear && tx.date <= endOfYear)
        .toArray();

      const catData = await db.categories.toArray();

      // Fetch savings map
      const mapKey = `actual_total_savings_map_${user.id}`;
      const setting = await db.settings.get(mapKey);
      if (setting && setting.value) {
        setSavingsMap(setting.value);
      } else {
        setSavingsMap({});
      }

      // Sort transactions by date ascending
      allTxRaw.sort((a, b) => new Date(a.date) - new Date(b.date));

      setTransactions(allTxRaw);
      setCategories(catData);
    } catch (err) {
      console.error('Error fetching statistics data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSavings = async (monthKey) => {
    try {
      const numValue = parseFloat(String(editSavingsValue).replace(/[^0-9]/g, ''));
      if (isNaN(numValue)) {
        setEditingSavingsMonth(null);
        return;
      }

      const mapKey = `actual_total_savings_map_${user.id}`;
      const newMap = { ...savingsMap, [monthKey]: { amount: numValue, isManual: true } };
      
      await db.settings.put({ key: mapKey, value: newMap });
      
      setSavingsMap(newMap);
    } catch (err) {
      console.error('Error saving savings override:', err);
    } finally {
      setEditingSavingsMonth(null);
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

    return {
      income,
      expense,
      net: income - expense
    };
  }, [transactions]);

  const monthlyCategoryData = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: `T${i + 1}`,
      income: [],
      expense: [],
      transfer: []
    }));

    transactions.forEach(tx => {
      const month = new Date(tx.date).getMonth();
      const cat = categories.find(c => c.id === tx.category_id);
      const categoryName = cat ? cat.name : 'Chưa phân loại';
      const categoryIcon = cat ? cat.icon : '📌';

      // Bỏ qua transfer không có category
      if (tx.type === 'transfer' && !tx.category_id) return;

      // Phân loại
      let targetList;
      if (tx.type === 'transfer') {
        targetList = data[month].transfer;
      } else {
        targetList = tx.type === 'income' ? data[month].income : data[month].expense;
      }

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
      m.transfer.sort((a, b) => b.amount - a.amount);
    });

    return data;
  }, [transactions, categories]);

  // --- THU HỘ / CHI HỘ RECONCILIATION ---
  const thuHoChiHoData = useMemo(() => {
    const thuHoCat = categories.find(c => c.name === 'Thu hộ');
    const chiHoCat = categories.find(c => c.name === 'Chi hộ');

    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: `T${i + 1}`,
      monthIndex: i,
      thuHo: 0,
      chiHo: 0,
      txs: []
    }));

    let totalThuHo = 0;
    let totalChiHo = 0;

    transactions.forEach(tx => {
      const month = new Date(tx.date).getMonth();
      const isThuHo = thuHoCat && tx.category_id === thuHoCat.id;
      const isChiHo = chiHoCat && tx.category_id === chiHoCat.id;

      if (isThuHo) {
        monthlyStats[month].thuHo += Number(tx.amount) || 0;
        monthlyStats[month].txs.push({ ...tx, _kind: 'thu' });
        totalThuHo += Number(tx.amount) || 0;
      }
      if (isChiHo) {
        monthlyStats[month].chiHo += Number(tx.amount) || 0;
        monthlyStats[month].txs.push({ ...tx, _kind: 'chi' });
        totalChiHo += Number(tx.amount) || 0;
      }
    });

    const activeMonths = monthlyStats.filter(m => m.thuHo > 0 || m.chiHo > 0);

    return {
      totalThuHo,
      totalChiHo,
      chenh: totalThuHo - totalChiHo,
      activeMonths,
      hasThuHoCat: !!thuHoCat,
      hasChiHoCat: !!chiHoCat,
      hasData: totalThuHo > 0 || totalChiHo > 0
    };
  }, [transactions, categories]);

  const handleOpenDetail = (title, data) => {
    setDetailSheet({
      isOpen: true,
      title,
      items: data
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
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} width={45}
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
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center">
                <TrendingUp size={16} className="mr-2 text-indigo-500" /> Hiệu quả tích lũy
              </h3>
              <span className="text-[10px] text-gray-400 font-medium">Đơn vị: Ngàn ₫</span>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} width={45} tickFormatter={(val) => new Intl.NumberFormat('vi-VN').format(val / 1000)} />
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
              <table className="w-full text-xs text-left tabular-nums">
                <thead className="bg-gray-50/50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="px-5 py-4">Tháng</th>
                    <th className="px-5 py-4 text-emerald-600">Thu nhập</th>
                    <th className="px-5 py-4 text-rose-500">Chi tiêu</th>
                    <th className="px-5 py-4 text-blue-600">Tích lũy</th>
                    <th className="px-5 py-4 text-indigo-500">Tổng tiết kiệm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5 text-gray-700 dark:text-slate-300 font-bold">
                  {monthlyData.filter(m => m.income > 0 || m.expense > 0).map((row) => {
                    const catData = monthlyCategoryData.find(m => m.month === row.month);
                    const monthKey = `${selectedYear}-${row.month.replace('T', '').padStart(2, '0')}`;
                    const savingsData = savingsMap[monthKey];
                    
                    return (
                    <tr
                      key={row.month}
                      className="hover:bg-blue-50/50 dark:hover:bg-indigo-950/20 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <td className="px-5 py-5 font-black dark:text-slate-100 flex items-center" onClick={() => handleOpenDetail(`Chi tiết ${row.month}`, {
                        type: 'monthly_category',
                        income: catData?.income || [],
                        expense: catData?.expense || [],
                        transfer: catData?.transfer || []
                      })}>
                        {row.month}
                        <ChevronRightIcon size={12} className="ml-1 opacity-20" />
                      </td>
                      <td className="px-5 py-5 text-emerald-600 dark:text-emerald-400" onClick={() => handleOpenDetail(`Chi tiết ${row.month}`, {
                        type: 'monthly_category',
                        income: catData?.income || [],
                        expense: catData?.expense || [],
                        transfer: catData?.transfer || []
                      })}>{formatCurrency(row.income)}</td>
                      <td className="px-5 py-5 text-rose-500 dark:text-rose-400" onClick={() => handleOpenDetail(`Chi tiết ${row.month}`, {
                        type: 'monthly_category',
                        income: catData?.income || [],
                        expense: catData?.expense || [],
                        transfer: catData?.transfer || []
                      })}>{formatCurrency(row.expense)}</td>
                      <td className={`px-5 py-5 ${row.net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-500 dark:text-orange-400'}`} onClick={() => handleOpenDetail(`Chi tiết ${row.month}`, {
                        type: 'monthly_category',
                        income: catData?.income || [],
                        expense: catData?.expense || [],
                        transfer: catData?.transfer || []
                      })}>
                        {row.net > 0 ? '+' : ''}{formatCurrency(row.net)}
                      </td>
                      <td 
                        className="px-5 py-5 text-indigo-500 font-black cursor-text"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingSavingsMonth !== monthKey) {
                            setEditingSavingsMonth(monthKey);
                            setEditSavingsValue(savingsData ? formatCurrency(savingsData.amount) : '');
                          }
                        }}
                      >
                        {editingSavingsMonth === monthKey ? (
                          <div className="flex items-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              autoFocus
                              className="w-24 px-2 py-1 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-indigo-500 tabular-nums"
                              value={editSavingsValue}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setEditSavingsValue(val ? new Intl.NumberFormat('vi-VN').format(val) : '');
                              }}
                              onBlur={() => handleSaveSavings(monthKey)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveSavings(monthKey)}
                            />
                          </div>
                        ) : (
                          <span 
                            className={`border-b border-dashed pb-0.5 ${savingsData?.isManual ? 'border-indigo-300 text-indigo-600 dark:text-indigo-400' : 'border-gray-300 text-gray-500 dark:text-gray-400'}`}
                          >
                            {savingsData ? formatCurrency(savingsData.amount) : '0'}
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 3: ĐỐI SOÁT THU HỘ / CHI HỘ --- */}
      <div className="mb-12">
        <div className="flex items-center mb-6 px-1">
          <div className="w-1.5 h-6 bg-amber-500 rounded-full mr-3 shadow-sm shadow-amber-500/40" />
          <h2 className="text-lg font-black text-gray-900 dark:text-slate-100 tracking-tight">Đối soát Thu hộ / Chi hộ</h2>
        </div>

        {(!thuHoChiHoData.hasThuHoCat && !thuHoChiHoData.hasChiHoCat) ? (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800/30 rounded-3xl p-6 flex items-start space-x-4">
            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Chưa có danh mục Thu hộ / Chi hộ</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Vào <strong>Cài đặt → Quản lý Danh mục</strong> và tạo danh mục tên <strong>"Thu hộ"</strong> (loại Thu nhập) và <strong>"Chi hộ"</strong> (loại Chi tiêu) để bắt đầu theo dõi.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {/* Tổng Thu hộ */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 rounded-full opacity-50" />
                <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Thu hộ</p>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight">{formatCurrency(thuHoChiHoData.totalThuHo)}<span className="text-[9px] ml-0.5 opacity-60">₫</span></p>
              </div>

              {/* Tổng Chi hộ */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-14 h-14 bg-rose-50 dark:bg-rose-950/30 rounded-full opacity-50" />
                <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Chi hộ</p>
                <p className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums leading-tight">{formatCurrency(thuHoChiHoData.totalChiHo)}<span className="text-[9px] ml-0.5 opacity-60">₫</span></p>
              </div>

              {/* Chênh lệch */}
              <div className={`p-4 rounded-[2rem] border shadow-sm relative overflow-hidden ${
                thuHoChiHoData.chenh >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-800/30'
                  : 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-800/30'
              }`}>
                <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Chênh lệch</p>
                <p className={`text-base font-black tabular-nums leading-tight ${
                  thuHoChiHoData.chenh >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {thuHoChiHoData.chenh > 0 ? '+' : ''}{formatCurrency(thuHoChiHoData.chenh)}<span className="text-[9px] ml-0.5 opacity-60">₫</span>
                </p>
              </div>
            </div>

            {/* Chú thích chênh lệch */}
            {thuHoChiHoData.chenh < 0 && (
              <div className="flex items-start space-x-2 mb-5 px-1">
                <Info size={13} className="text-orange-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-orange-500 dark:text-orange-400 font-medium">
                  Chi hộ đang lớn hơn Thu hộ <strong>{formatCurrency(Math.abs(thuHoChiHoData.chenh))}₫</strong> — bạn đang ứng tiền từ tài khoản cá nhân.
                </p>
              </div>
            )}
            {thuHoChiHoData.chenh > 0 && (
              <div className="flex items-start space-x-2 mb-5 px-1">
                <Info size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Thu hộ đang lớn hơn Chi hộ <strong>{formatCurrency(thuHoChiHoData.chenh)}₫</strong> — bạn đang giữ tiền hộ người khác.
                </p>
              </div>
            )}

            {/* Monthly breakdown table */}
            {thuHoChiHoData.activeMonths.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-white/5 p-10 text-center">
                <ArrowLeftRight size={28} className="text-gray-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-gray-400 dark:text-slate-500 italic">Chưa có giao dịch Thu hộ / Chi hộ trong {selectedYear}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left tabular-nums">
                    <thead className="bg-gray-50/50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                      <tr>
                        <th className="px-5 py-4">Tháng</th>
                        <th className="px-5 py-4 text-emerald-600">Thu hộ</th>
                        <th className="px-5 py-4 text-rose-500">Chi hộ</th>
                        <th className="px-5 py-4 text-amber-500">Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5 text-gray-700 dark:text-slate-300 font-bold">
                      {thuHoChiHoData.activeMonths.map((row) => {
                        const chenh = row.thuHo - row.chiHo;
                        return (
                          <tr
                            key={row.month}
                            onClick={() => handleOpenDetail(`Chi tiết ${row.month} — Thu hộ/Chi hộ`, {
                              type: 'thu_chi_ho_monthly',
                              txs: row.txs
                            })}
                            className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all cursor-pointer active:scale-[0.98]"
                          >
                            <td className="px-5 py-5 font-black dark:text-slate-100 flex items-center">
                              {row.month}
                              <ChevronRightIcon size={12} className="ml-1 opacity-20" />
                            </td>
                            <td className="px-5 py-5 text-emerald-600 dark:text-emerald-400">{row.thuHo > 0 ? formatCurrency(row.thuHo) : <span className="text-gray-300 dark:text-slate-600">—</span>}</td>
                            <td className="px-5 py-5 text-rose-500 dark:text-rose-400">{row.chiHo > 0 ? formatCurrency(row.chiHo) : <span className="text-gray-300 dark:text-slate-600">—</span>}</td>
                            <td className={`px-5 py-5 ${
                              chenh === 0 ? 'text-gray-400'
                              : chenh > 0 ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-orange-500 dark:text-orange-400'
                            }`}>
                              {chenh > 0 ? '+' : ''}{formatCurrency(chenh)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Footer tổng */}
                    <tfoot className="bg-gray-50/80 dark:bg-slate-800/80 text-[10px] font-black">
                      <tr>
                        <td className="px-5 py-4 text-gray-500 dark:text-slate-400 uppercase tracking-wider">Cả năm</td>
                        <td className="px-5 py-4 text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(thuHoChiHoData.totalThuHo)}</td>
                        <td className="px-5 py-4 text-rose-500 dark:text-rose-400 tabular-nums">{formatCurrency(thuHoChiHoData.totalChiHo)}</td>
                        <td className={`px-5 py-4 tabular-nums ${
                          thuHoChiHoData.chenh === 0 ? 'text-gray-400'
                          : thuHoChiHoData.chenh > 0 ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-orange-500 dark:text-orange-400'
                        }`}>
                          {thuHoChiHoData.chenh > 0 ? '+' : ''}{formatCurrency(thuHoChiHoData.chenh)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
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
              {/* Transfer Section */}
              {detailSheet.items.transfer && detailSheet.items.transfer.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 px-1">Chuyển khoản (Trích lập)</h4>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5 shadow-sm">
                    {detailSheet.items.transfer.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-lg">{cat.icon}</div>
                          <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{cat.name}</span>
                        </div>
                        <span className="text-sm font-black text-indigo-500">{formatCurrency(cat.amount)}₫</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {detailSheet.items.income.length === 0 && detailSheet.items.expense.length === 0 && (!detailSheet.items.transfer || detailSheet.items.transfer.length === 0) && (
                <div className="text-center py-10 text-gray-400 italic">Không có giao dịch nào trong tháng này</div>
              )}
            </div>
          )}

          {/* Thu hộ / Chi hộ Monthly Detail View */}
          {detailSheet.items.type === 'thu_chi_ho_monthly' && (
            <div className="space-y-6">
              {/* Thu hộ transactions */}
              {detailSheet.items.txs.filter(tx => tx._kind === 'thu').length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 px-1">Thu hộ</h4>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5 shadow-sm">
                    {detailSheet.items.txs.filter(tx => tx._kind === 'thu').map((tx, idx) => (
                      <div key={tx.id || idx} className="flex items-center justify-between p-4">
                        <div className="flex-1 truncate pr-3">
                          <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate">{tx.note || 'Thu hộ'}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{new Date(tx.date).toLocaleDateString('vi-VN')}</p>
                        </div>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">+{formatCurrency(tx.amount)}₫</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 bg-emerald-50/60 dark:bg-emerald-950/20">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Tổng Thu hộ</span>
                      <span className="text-sm font-black text-emerald-600 tabular-nums">
                        +{formatCurrency(detailSheet.items.txs.filter(tx => tx._kind === 'thu').reduce((s, tx) => s + tx.amount, 0))}₫
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chi hộ transactions */}
              {detailSheet.items.txs.filter(tx => tx._kind === 'chi').length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 px-1">Chi hộ</h4>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5 shadow-sm">
                    {detailSheet.items.txs.filter(tx => tx._kind === 'chi').map((tx, idx) => (
                      <div key={tx.id || idx} className="flex items-center justify-between p-4">
                        <div className="flex-1 truncate pr-3">
                          <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate">{tx.note || 'Chi hộ'}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{new Date(tx.date).toLocaleDateString('vi-VN')}</p>
                        </div>
                        <span className="text-sm font-black text-rose-500 dark:text-rose-400 tabular-nums shrink-0">-{formatCurrency(tx.amount)}₫</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 bg-rose-50/60 dark:bg-rose-950/20">
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider">Tổng Chi hộ</span>
                      <span className="text-sm font-black text-rose-500 tabular-nums">
                        -{formatCurrency(detailSheet.items.txs.filter(tx => tx._kind === 'chi').reduce((s, tx) => s + tx.amount, 0))}₫
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chênh lệch summary */}
              {(() => {
                const totalThu = detailSheet.items.txs.filter(tx => tx._kind === 'thu').reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
                const totalChi = detailSheet.items.txs.filter(tx => tx._kind === 'chi').reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
                const diff = totalThu - totalChi;
                return (
                  <div className={`flex items-center justify-between px-5 py-4 rounded-3xl border ${
                    diff > 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-800/30'
                    : diff < 0 ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-800/30'
                    : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-white/5'
                  }`}>
                    <span className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">Chênh lệch tháng này</span>
                    <span className={`text-sm font-black tabular-nums ${
                      diff > 0 ? 'text-emerald-600 dark:text-emerald-400'
                      : diff < 0 ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-500'
                    }`}>
                      {diff > 0 ? '+' : ''}{formatCurrency(diff)}₫
                    </span>
                  </div>
                );
              })()}

              {detailSheet.items.txs.length === 0 && (
                <div className="text-center py-10 text-gray-400 italic">Không có giao dịch nào</div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
