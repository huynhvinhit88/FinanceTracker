import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { Plus, Wallet, PiggyBank, TrendingUp, HandCoins, Building, CreditCard, CircleDollarSign, RefreshCw, Landmark, Clock, PieChart as PieChartIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, toViDecimal, formatDate } from '../utils/format';
import { AddAccountSheet } from '../components/accounts/AddAccountSheet';
import { EditAccountSheet } from '../components/accounts/EditAccountSheet';
import { AddSavingsSheet } from '../components/wealth/AddSavingsSheet';
import { EditSavingsSheet } from '../components/wealth/EditSavingsSheet';
import { AddInvestmentSheet } from '../components/wealth/AddInvestmentSheet';
import { EditInvestmentSheet } from '../components/wealth/EditInvestmentSheet';
import { AddLoanSheet } from '../components/loans/AddLoanSheet';
import { LoanDetailSheet } from '../components/loans/LoanDetailSheet';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useLoans } from '../hooks/useLoans';
import { useGlobalRefresh } from '../hooks/useGlobalRefresh';

// Bảng màu cho biểu đồ cơ cấu (đồng bộ với trang Thống kê cũ)
const SAVINGS_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function Accounts() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'savings', 'invest', 'loans'
  // Danh sách tiêu chí gom nhóm sổ tiết kiệm, CÓ THỨ TỰ (thứ tự chọn = thứ tự lồng nhóm).
  // Mảng rỗng = không nhóm (hiển thị phẳng). Giá trị hợp lệ: 'account' | 'category' | 'maturity'.
  const [savingsGroupBy, setSavingsGroupBy] = useState([]);

  const [accounts, setAccounts] = useState([]);
  const [savings, setSavings] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [savingsCategories, setSavingsCategories] = useState([]);
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

  // Sheet chi tiết danh sách sổ (mở từ phần Phân tích Tiết kiệm)
  const [detailSheet, setDetailSheet] = useState({ isOpen: false, title: '', books: [] });

  useEffect(() => {
    fetchWealthData();
    fetchLoans();
  }, [user]);

  // Tự fetch lại khi thêm giao dịch từ nút "+" toàn cục
  useGlobalRefresh(() => {
    fetchWealthData();
    fetchLoans();
  });

  const fetchWealthData = async () => {
    setLoading(true);
    try {
      const accRaw = await db.accounts.toArray();
      const savRaw = await db.savings.toArray();
      const invRaw = await db.investments.toArray();
      
      // Sắp xếp thủ công để tránh mất dữ liệu nếu thiếu trường index
      const accData = accRaw.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      const savData = savRaw.sort((a, b) => {
        // Active first
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        
        // Then by maturity date
        if (a.status === 'active') {
          // Both active: soonest maturity first
          const dateA = a.maturity_date ? new Date(a.maturity_date) : new Date(8640000000000000); // Far future if missing
          const dateB = b.maturity_date ? new Date(b.maturity_date) : new Date(8640000000000000);
          return dateA - dateB;
        } else {
          // Both settled: most recently matured first (descending)
          const dateA = a.maturity_date ? new Date(a.maturity_date) : new Date(0);
          const dateB = b.maturity_date ? new Date(b.maturity_date) : new Date(0);
          return dateB - dateA;
        }
      });

      const invData = invRaw.sort((a, b) => new Date(b.purchase_date || 0) - new Date(a.purchase_date || 0));
      
      setAccounts(accData);
      setSavings(savData);
      setInvestments(invData);

      const catRaw = await db.categories.filter(c => c.type === 'savings').toArray();
      setSavingsCategories(catRaw);
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
  
  const totalPayment = (accounts || []).reduce((acc, curr) => {
    if (curr?.sub_type === 'payment') return acc + (Number(curr?.balance) || 0);
    return acc;
  }, 0);

  const totalReceivable = (accounts || []).reduce((acc, curr) => {
    if (curr?.sub_type === 'receivable') return acc + (Number(curr?.balance) || 0);
    return acc;
  }, 0);

  const totalSavingsAcc = (accounts || []).reduce((acc, curr) => {
    if (curr?.sub_type === 'savings') return acc + (Number(curr?.balance) || 0);
    return acc;
  }, 0);

  const totalCashAndReceivable = totalPayment + totalReceivable + totalSavingsAcc;

  const totalDebtAccounts = (accounts || []).reduce((acc, curr) => {
    if (curr?.sub_type === 'debt') return acc + (Number(curr?.balance) || 0);
    return acc;
  }, 0);

  // Savings Math
  const computeSavingsMath = (sav) => {
    if (!sav) return { accruedInterest: 0, expectedTotalInterest: 0, daysPassed: 0 };
    const startDate = sav.start_date ? new Date(sav.start_date) : new Date();
    const daysPassed = Math.max(0, Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24)));
    const dailyRate = ((Number(sav.interest_rate) || 0) / 100) / 365;
    const accruedInterest = (Number(sav.principal_amount) || 0) * dailyRate * (isNaN(daysPassed) ? 0 : daysPassed);
    const expectedTotalInterest = (Number(sav.principal_amount) || 0) * ((Number(sav.interest_rate) || 0) / 100) * ((Number(sav.term_months) || 0) / 12);
    return { 
      accruedInterest: isNaN(accruedInterest) ? 0 : Math.floor(accruedInterest), 
      expectedTotalInterest: isNaN(expectedTotalInterest) ? 0 : Math.floor(expectedTotalInterest), 
      daysPassed: isNaN(daysPassed) ? 0 : daysPassed 
    };
  };

  const totalSavingsValue = (savings || []).reduce((acc, curr) => {
    if (curr?.status !== 'active') return acc;
    return acc + (Number(curr?.principal_amount) || 0);
  }, 0);

  // --- PHÂN TÍCH TIẾT KIỆM (cơ cấu theo hạng mục / tài khoản + lịch trình đáo hạn) ---
  // Chuyển từ trang Thống kê sang đây; chỉ tính trên các sổ đang hoạt động.
  const activeSavingsAnalysis = useMemo(() => {
    const activeBooks = (savings || []).filter(b => b.status === 'active');

    // Gắn lãi dự kiến cho từng sổ (dùng chung công thức với computeSavingsMath)
    const enrichedBooks = activeBooks.map(b => ({
      ...b,
      expected_interest: computeSavingsMath(b).expectedTotalInterest,
    }));

    const totalPrincipal = enrichedBooks.reduce((sum, b) => sum + (Number(b.principal_amount) || 0), 0);
    const totalInterest = enrichedBooks.reduce((sum, b) => sum + (Number(b.expected_interest) || 0), 0);

    // 1. Cơ cấu theo Hạng mục (danh mục tiết kiệm)
    const byCategoryMap = {};
    enrichedBooks.forEach(b => {
      const catId = b.category_id || 'unclassified';
      if (!byCategoryMap[catId]) {
        const cat = savingsCategories.find(c => c.id === catId);
        byCategoryMap[catId] = {
          name: cat ? cat.name : 'Chưa phân loại',
          icon: cat ? cat.icon : '📌',
          amount: 0,
          interest: 0,
          books: [],
        };
      }
      byCategoryMap[catId].amount += Number(b.principal_amount) || 0;
      byCategoryMap[catId].interest += Number(b.expected_interest) || 0;
      byCategoryMap[catId].books.push(b);
    });
    const byCategory = Object.values(byCategoryMap).sort((a, b) => b.amount - a.amount);

    // 2. Cơ cấu theo Tài khoản — kèm chia nhỏ theo danh mục bên trong mỗi tài khoản
    const byAccountMap = {};
    enrichedBooks.forEach(b => {
      const accId = b.account_id || 'unclassified';
      if (!byAccountMap[accId]) {
        const acc = accounts.find(a => a.id === accId);
        byAccountMap[accId] = {
          name: acc ? acc.name : 'Không rõ nguồn',
          amount: 0,
          interest: 0,
          books: [],
          catMap: {},
        };
      }
      const g = byAccountMap[accId];
      g.amount += Number(b.principal_amount) || 0;
      g.interest += Number(b.expected_interest) || 0;
      g.books.push(b);

      // Gom theo danh mục bên trong tài khoản này
      const catId = b.category_id || 'unclassified';
      if (!g.catMap[catId]) {
        const cat = savingsCategories.find(c => c.id === catId);
        g.catMap[catId] = {
          name: cat ? cat.name : 'Chưa phân loại',
          icon: cat ? cat.icon : '📌',
          amount: 0,
          interest: 0,
          books: [],
        };
      }
      g.catMap[catId].amount += Number(b.principal_amount) || 0;
      g.catMap[catId].interest += Number(b.expected_interest) || 0;
      g.catMap[catId].books.push(b);
    });
    const byAccount = Object.values(byAccountMap)
      .map(g => ({
        name: g.name,
        amount: g.amount,
        interest: g.interest,
        books: g.books,
        categories: Object.values(g.catMap).sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount);

    // 3. Lịch trình đáo hạn (theo tháng YYYY-MM)
    const maturityMap = {};
    enrichedBooks.forEach(b => {
      if (!b.maturity_date) return;
      const date = new Date(b.maturity_date);
      const mmYyyy = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
      const sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!maturityMap[sortKey]) {
        maturityMap[sortKey] = { label: mmYyyy, principal: 0, interest: 0, books: [] };
      }
      maturityMap[sortKey].principal += Number(b.principal_amount) || 0;
      maturityMap[sortKey].interest += Number(b.expected_interest) || 0;
      maturityMap[sortKey].books.push(b);
    });
    const timeline = Object.entries(maturityMap)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([, val]) => val);

    return { totalPrincipal, totalInterest, byCategory, byAccount, timeline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savings, savingsCategories, accounts]);

  // Mở sheet chi tiết danh sách sổ; sắp xếp sổ theo ngày đáo hạn gần nhất.
  const handleOpenDetail = (title, books) => {
    const sorted = [...(books || [])].sort((a, b) => new Date(a.maturity_date || 0) - new Date(b.maturity_date || 0));
    setDetailSheet({ isOpen: true, title, books: sorted });
  };

  // Investment Math
  const totalInvestmentNet = (investments || []).reduce((acc, curr) => {
    const marketVal = (Number(curr?.current_price) || 0) * (curr?.type === 'real_estate' ? 1 : (Number(curr?.quantity) || 1));
    const debt = Number(curr?.loan_amount) || 0;
    return acc + (marketVal - debt);
  }, 0);

  const totalInvestmentMarketValue = (investments || []).reduce((acc, curr) => {
    const marketVal = (Number(curr?.current_price) || 0) * (curr?.type === 'real_estate' ? 1 : (Number(curr?.quantity) || 1));
    return acc + marketVal;
  }, 0);

  // Nợ thẻ/Sổ nợ (debt accounts) nay là số dư thực âm → đã nằm trong totalDebtAccounts,
  // không cộng vào liabilities nữa. Chỉ còn nợ vay chưa gắn tài sản đầu tư.
  const totalOtherLiabilities = (loans || []).reduce((acc, l) => {
    if (l?.status === 'active' && !l?.linked_investment_id) {
       return acc + (Number(l?.remaining_principal) ?? Number(l?.total_amount) ?? 0);
    }
    return acc;
  }, 0);

  const totalLoanRemaining = (loans || []).reduce((acc, l) => acc + (l?.status === 'active' ? (Number(l?.remaining_principal) ?? Number(l?.total_amount) ?? 0) : 0), 0);

  // totalDebtAccounts đã âm (đang nợ) nên cộng vào = tự khấu trừ phần nợ thẻ.
  const globalNetWorth = totalCashAndReceivable + totalSavingsValue + totalInvestmentNet + totalDebtAccounts - totalOtherLiabilities;
  const activeLoans = loans.filter(l => l.status === 'active');
  const paidOffLoans = loans.filter(l => l.status === 'paid_off');

  // --- Renderers ---

  // Hiển thị số dư CÓ DẤU cho sổ nợ / thẻ tín dụng:
  //   âm (đang nợ)  → dấu trừ + màu đỏ
  //   dương (dư có) → dấu cộng + màu xanh
  //   bằng 0        → trung tính
  const getSignedBalanceDisplay = (value) => {
    const num = Number(value) || 0;
    if (num < 0) return { text: `-${formatCurrency(Math.abs(num))}`, color: 'text-red-600 dark:text-rose-400' };
    if (num > 0) return { text: `+${formatCurrency(num)}`, color: 'text-emerald-600 dark:text-emerald-400' };
    return { text: formatCurrency(0), color: 'text-gray-900 dark:text-slate-100' };
  };

  const renderCashTab = () => {
    const paymentAccounts = accounts.filter(a => a.sub_type === 'payment' || a.sub_type === 'receivable');
    const savingsAccounts = accounts.filter(a => a.sub_type === 'savings');
    const debtAccounts = accounts.filter(a => a.sub_type === 'debt');

    const getAccountIcon = (type, sub_type) => {
      // Safety: Use icons only if they are defined (handle potentially missing icons in old lucide versions)
      const SafeHandCoins = HandCoins || CircleDollarSign || Wallet;
      const SafeCreditCard = CreditCard || Wallet;
      const SafeBuilding = Building || Wallet;
      const SafeWallet = Wallet;

      if (sub_type === 'debt') return <SafeCreditCard className="text-red-500" />;
      if (sub_type === 'receivable') return <SafeHandCoins className="text-emerald-500 dark:text-emerald-400" />;
      if (type === 'bank') return <SafeBuilding className="text-blue-500 dark:text-blue-400" />;
      return <SafeWallet className="text-gray-700 dark:text-slate-400" />;
    };

    const renderGroup = (title, items) => {
      if (items.length === 0) return null;
      return (
        <div className="mb-8">
          <h3 className="font-black text-gray-900 dark:text-slate-100 text-lg lg:text-xl mb-4 px-1">{title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-6">
            {items.map(acc => {
              // Calculate linked active savings
              const linkedSavings = savings.filter(s => s.account_id === acc.id && s.status === 'active');
              const totalSavingsForAcc = linkedSavings.reduce((sum, s) => sum + (Number(s.principal_amount) || 0), 0);
              const hasSavings = totalSavingsForAcc > 0;

              // Sổ nợ/thẻ tín dụng: hiển thị số dư có dấu (âm=nợ đỏ, dương=dư có xanh).
              const signedBalance = acc.sub_type === 'debt' ? getSignedBalanceDisplay(acc.balance) : null;

              return (
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
                    <p className={`font-bold text-lg ${signedBalance ? signedBalance.color : acc.sub_type === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-slate-100'}`}>
                      {signedBalance ? signedBalance.text : `${acc.sub_type === 'receivable' ? '+' : ''}${formatCurrency(acc.balance)}`} đ
                    </p>
                    {hasSavings && (
                      <div className="flex flex-col items-end mt-1">
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                          <PiggyBank size={10} className="mr-1" /> Tiết kiệm: +{formatCurrency(totalSavingsForAcc)} đ
                        </p>
                        <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-tighter mt-0.5">
                          Tổng: {formatCurrency(acc.balance + totalSavingsForAcc)} đ
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col justify-center">
            <p className="text-[10px] lg:text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">TK Thanh toán</p>
            <p className="text-lg lg:text-xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(totalPayment)} ₫</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 flex flex-col justify-center">
            <p className="text-[10px] lg:text-[11px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-1.5">Phải thu</p>
            <p className="text-lg lg:text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalReceivable)} ₫</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-sm border border-blue-50 dark:border-blue-900/30 flex flex-col justify-center">
            <p className="text-[10px] lg:text-[11px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1.5">TK Tiết kiệm</p>
            <p className="text-lg lg:text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(totalSavingsAcc)} ₫</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-sm border border-red-50 dark:border-rose-900/30 flex flex-col justify-center">
            <p className="text-[10px] lg:text-[11px] font-bold text-red-400 dark:text-rose-400 uppercase tracking-widest mb-1.5">Sổ nợ / Thẻ tín dụng</p>
            <p className={`text-lg lg:text-xl font-black ${getSignedBalanceDisplay(totalDebtAccounts).color}`}>{getSignedBalanceDisplay(totalDebtAccounts).text} ₫</p>
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

  // Card 1 sổ tiết kiệm — tách riêng để tái dùng ở cả chế độ phẳng lẫn nhóm.
  const renderSavingsCard = (sav) => {
    const { expectedTotalInterest } = computeSavingsMath(sav);
    const isSettled = sav.status !== 'active';
    const sourceAccount = accounts.find(a => a.id === sav.account_id);
    const savCategory = savingsCategories.find(c => c.id === sav.category_id);
    return (
      <div
        key={sav.id}
        onClick={() => handleSavingsClick(sav)}
        className={`p-4 rounded-2xl shadow-sm border ${isSettled ? 'bg-gray-50 dark:bg-slate-800/40 border-gray-100 dark:border-white/5 opacity-60' : 'bg-white dark:bg-slate-900 border-emerald-50 dark:border-emerald-900/30'} relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer`}
      >
        {isSettled && <div className="absolute top-0 right-0 bg-gray-200 dark:bg-slate-700 text-xs px-2 py-1 font-bold text-gray-600 dark:text-slate-400 rounded-bl-lg">Đã tất toán</div>}

        <div className="flex items-start justify-between mb-1">
          <h4 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{sav.name}</h4>
          {savCategory && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 whitespace-nowrap ml-2 mt-1">
              {savCategory.icon} {savCategory.name}
            </span>
          )}
        </div>

        {sourceAccount && (
          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium mb-3 flex items-center">
            <PiggyBank size={10} className="mr-1 flex-shrink-0" />
            Nguồn: {sourceAccount.name}
          </p>
        )}

        {!isSettled && sav.auto_renew && (
          <div className="inline-flex items-center text-[10px] font-bold text-blue-600 dark:text-indigo-400 bg-blue-50 dark:bg-indigo-900/20 border border-blue-100 dark:border-indigo-900/40 px-2 py-0.5 rounded-full mb-3">
            <RefreshCw size={10} className="mr-1 flex-shrink-0" />
            Tái tục tự động{sav.auto_renew_compound ? ' (lãi kép)' : ''}
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs font-medium mb-4">
          <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/50">
            {toViDecimal(sav.interest_rate)}%/năm
          </div>
          <div className="text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-100 dark:border-blue-900/50">
            Kỳ hạn {sav.term_months} tháng
          </div>
          {sav.maturity_date && (
            <div className="text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-white/5">
              Tất toán: {formatDate(sav.maturity_date)}
            </div>
          )}
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
  };

  // Trích thông tin nhóm (key, nhãn, giá trị sắp xếp) của một sổ theo MỘT tiêu chí.
  const getSavingsGroupInfo = (sav, criterion) => {
    if (criterion === 'account') {
      const acc = accounts.find(a => a.id === sav.account_id);
      return {
        key: sav.account_id || '__none__',
        label: acc ? acc.name : 'Không rõ tài khoản',
        sortVal: acc ? `0_${acc.name.toLowerCase()}` : '9_',
      };
    }
    if (criterion === 'category') {
      const cat = savingsCategories.find(c => c.id === sav.category_id);
      return {
        key: sav.category_id || '__none__',
        label: cat ? `${cat.icon} ${cat.name}` : 'Chưa phân loại',
        // Sổ chưa phân loại đẩy xuống cuối; còn lại sắp theo tên danh mục.
        sortVal: cat ? `0_${cat.name.toLowerCase()}` : '9_',
      };
    }
    // 'maturity' — nhóm theo tháng tất toán (YYYY-MM)
    const md = sav.maturity_date;
    if (md && md.length >= 7) {
      const ym = md.slice(0, 7); // YYYY-MM
      return { key: ym, label: `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)}`, sortVal: ym };
    }
    return { key: '__none__', label: 'Chưa rõ ngày tất toán', sortVal: '9999-99' };
  };

  // Gom danh sách sổ thành nhóm LỒNG NHAU theo mảng tiêu chí (đệ quy theo thứ tự).
  // Trả về mảng nhóm đã sắp xếp; mỗi nhóm có key, label, items, totalPrincipal (gốc active)
  // và subGroups (nhóm con theo tiêu chí kế tiếp; null nếu đây là cấp cuối).
  const buildSavingsGroups = (items, criteria) => {
    if (!criteria || criteria.length === 0) return null;
    const [first, ...rest] = criteria;
    const groupsMap = new Map();
    for (const sav of items) {
      const { key, label, sortVal } = getSavingsGroupInfo(sav, first);
      if (!groupsMap.has(key)) groupsMap.set(key, { key, label, sortVal, items: [], totalPrincipal: 0 });
      const g = groupsMap.get(key);
      g.items.push(sav);
      if (sav.status === 'active') g.totalPrincipal += Number(sav.principal_amount) || 0;
    }
    const groups = Array.from(groupsMap.values()).sort((a, b) => {
      if (a.sortVal < b.sortVal) return -1;
      if (a.sortVal > b.sortVal) return 1;
      return 0;
    });
    // Đệ quy gom tiếp các tiêu chí còn lại trong từng nhóm.
    for (const g of groups) {
      g.subGroups = buildSavingsGroups(g.items, rest);
    }
    return groups;
  };

  // Bật/tắt một tiêu chí gom nhóm. Thứ tự bấm = thứ tự lồng nhóm.
  const toggleSavingsGroupBy = (id) => {
    setSavingsGroupBy(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Render đệ quy danh sách nhóm (lồng nhau). level càng sâu thì tiêu đề càng nhỏ và thụt vào.
  const renderSavingsGroupList = (groups, level = 0) => (
    groups.map(group => (
      <div key={group.key} className={level === 0 ? 'mb-8' : 'mb-5'} style={level > 0 ? { marginLeft: '0.75rem' } : undefined}>
        <div className={`flex items-baseline justify-between mb-3 px-1 ${level > 0 ? 'border-l-2 border-emerald-200 dark:border-emerald-900/40 pl-2' : ''}`}>
          <h4 className={`font-black text-gray-900 dark:text-slate-100 ${level === 0 ? 'text-base lg:text-lg' : 'text-sm lg:text-base text-gray-700 dark:text-slate-300'}`}>{group.label}</h4>
          <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
            {group.items.length} sổ · Gốc: {formatCurrency(group.totalPrincipal)} ₫
          </span>
        </div>
        {group.subGroups
          ? renderSavingsGroupList(group.subGroups, level + 1)
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-8">
              {group.items.map(renderSavingsCard)}
            </div>
          )}
      </div>
    ))
  );

  const renderSavingsTab = () => {
    const groupOptions = [
      { id: 'account', label: 'Theo tài khoản' },
      { id: 'category', label: 'Theo danh mục' },
      { id: 'maturity', label: 'Theo tháng tất toán' },
    ];
    // Chỉ hiển thị sổ đang hoạt động; ẩn các sổ đã tất toán khỏi danh sách.
    const visibleSavings = savings.filter(s => s.status === 'active');
    const groups = savingsGroupBy.length === 0 ? null : buildSavingsGroups(visibleSavings, savingsGroupBy);

    return (
      <div className="space-y-8">
        {/* Tổng quan: khối lượng gốc + tổng lãi dự kiến */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 shadow-sm border border-emerald-50 dark:border-emerald-900/30 flex flex-col justify-center">
            <p className="text-[10px] lg:text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center">
              <Wallet size={14} className="mr-2" /> Khối lượng Tiết kiệm
            </p>
            <p className="text-3xl lg:text-5xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(totalSavingsValue)} ₫</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 shadow-xl shadow-indigo-500/20 flex flex-col justify-center">
            <p className="text-[10px] lg:text-xs font-bold text-white/70 uppercase tracking-widest mb-2 flex items-center">
              <TrendingUp size={14} className="mr-2" /> Tổng lãi dự kiến
            </p>
            <p className="text-3xl lg:text-5xl font-black text-white">+{formatCurrency(activeSavingsAnalysis.totalInterest)} ₫</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">Các Sổ Tiết Kiệm</h3>
            <button onClick={() => setIsAddSavingsOpen(true)} className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold active:scale-95 transition-transform"><Plus size={18} /></button>
          </div>

          {/* Bộ chọn cách nhóm danh sách sổ tiết kiệm (đa tiêu chí, lồng nhau theo thứ tự bấm) */}
          {visibleSavings.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {groupOptions.map(opt => {
                const order = savingsGroupBy.indexOf(opt.id); // -1 nếu chưa chọn
                const active = order !== -1;
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleSavingsGroupBy(opt.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5 ${
                      active
                        ? 'bg-emerald-600 dark:bg-emerald-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {active && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/25 text-[10px] font-black">{order + 1}</span>
                    )}
                    {opt.label}
                  </button>
                );
              })}
              {savingsGroupBy.length > 0 && (
                <button
                  onClick={() => setSavingsGroupBy([])}
                  className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors flex-shrink-0"
                >
                  Xóa nhóm
                </button>
              )}
            </div>
          )}

          {visibleSavings.length === 0 && <p className="text-gray-500 dark:text-slate-500 text-sm text-center py-6">Chưa có sổ tiết kiệm nào.</p>}

          {/* Chế độ phẳng (không nhóm) */}
          {visibleSavings.length > 0 && savingsGroupBy.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-8">
              {visibleSavings.map(renderSavingsCard)}
            </div>
          )}

          {/* Chế độ nhóm (có thể lồng nhiều cấp) */}
          {visibleSavings.length > 0 && savingsGroupBy.length > 0 && renderSavingsGroupList(groups)}
        </div>

        {/* --- PHÂN TÍCH TIẾT KIỆM (chuyển từ trang Thống kê) --- */}
        {visibleSavings.length > 0 && (
          <div>
            <div className="flex items-center mb-6 px-1">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3 shadow-sm shadow-indigo-500/40" />
              <h3 className="text-lg font-black text-gray-900 dark:text-slate-100 tracking-tight">Phân tích Tiết kiệm</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Cơ cấu theo Hạng mục */}
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] lg:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-6">
                  <h4 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6 text-sm">
                    <PieChartIcon size={16} className="mr-2 text-indigo-500" /> Cơ cấu theo Hạng mục
                  </h4>
                  <div className="space-y-3">
                    {activeSavingsAnalysis.byCategory.map((cat, idx) => (
                      <div
                        key={cat.name}
                        onClick={() => handleOpenDetail(`Sổ tiết kiệm: ${cat.name}`, cat.books)}
                        className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-white/5"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: SAVINGS_COLORS[idx % SAVINGS_COLORS.length] + '20', color: SAVINGS_COLORS[idx % SAVINGS_COLORS.length] }}>
                            {cat.icon || '📌'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{cat.name}</p>
                            <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500">{Math.round((cat.amount / (activeSavingsAnalysis.totalPrincipal || 1)) * 100)}% tổng vốn</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center flex-shrink-0">
                          <div className="mr-2">
                            <p className="text-sm font-black text-gray-900 dark:text-slate-100 tabular-nums">{formatCurrency(cat.amount)}₫</p>
                            <p className="text-[10px] font-bold text-emerald-500 tabular-nums">+{formatCurrency(cat.interest)}₫ lãi</p>
                          </div>
                          <ChevronRightIcon size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cơ cấu theo Tài khoản — kèm chi tiết theo danh mục bên trong mỗi tài khoản */}
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] lg:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-6">
                  <h4 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6 text-sm">
                    <Landmark size={16} className="mr-2 text-blue-500" /> Cơ cấu theo Tài khoản
                  </h4>
                  <div className="space-y-4">
                    {activeSavingsAnalysis.byAccount.map((acc) => (
                      <div key={acc.name} className="rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                        {/* Dòng tổng của tài khoản */}
                        <div
                          onClick={() => handleOpenDetail(`Tài khoản: ${acc.name}`, acc.books)}
                          className="group flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                              <Landmark size={20} className="text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{acc.name}</p>
                              <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500">{Math.round((acc.amount / (activeSavingsAnalysis.totalPrincipal || 1)) * 100)}% tổng vốn</p>
                            </div>
                          </div>
                          <div className="text-right flex items-center flex-shrink-0">
                            <div className="mr-2">
                              <p className="text-sm font-black text-gray-900 dark:text-slate-100 tabular-nums">{formatCurrency(acc.amount)}₫</p>
                              <p className="text-[10px] font-bold text-emerald-500 tabular-nums">+{formatCurrency(acc.interest)}₫ lãi</p>
                            </div>
                            <ChevronRightIcon size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>

                        {/* Chi tiết theo danh mục trong tài khoản (tiết kiệm, nhà ở TK...) */}
                        <div className="bg-gray-50/60 dark:bg-slate-800/30 border-t border-gray-100 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/5">
                          {acc.categories.map((cat) => (
                            <div
                              key={cat.name}
                              onClick={() => handleOpenDetail(`${acc.name} · ${cat.name}`, cat.books)}
                              className="flex items-center justify-between pl-5 pr-3 py-2 hover:bg-white dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className="text-sm flex-shrink-0">{cat.icon || '📌'}</span>
                                <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 truncate">{cat.name}</span>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs font-bold text-gray-800 dark:text-slate-200 tabular-nums">{formatCurrency(cat.amount)}₫</p>
                                <p className="text-[9px] font-bold text-emerald-500 tabular-nums">+{formatCurrency(cat.interest)}₫</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lịch trình nhận tiền (Gốc + Lãi) */}
              {activeSavingsAnalysis.timeline.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] lg:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden lg:col-span-2">
                  <div className="p-6">
                    <h4 className="font-bold text-gray-900 dark:text-slate-100 flex items-center mb-6 text-sm">
                      <Clock size={16} className="mr-2 text-orange-500" /> Lịch trình nhận tiền (Gốc + Lãi)
                    </h4>

                    {/* Biểu đồ timeline */}
                    <div className="h-40 w-full mb-6">
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

                    {/* Danh sách timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeSavingsAnalysis.timeline.map((item) => (
                        <div
                          key={item.label}
                          onClick={() => handleOpenDetail(`Đáo hạn: ${item.label}`, item.books)}
                          className="flex items-center p-4 rounded-3xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30"
                        >
                          <div className="w-14 text-center border-r border-gray-200 dark:border-white/5 mr-4">
                            <p className="text-[8px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-tighter">Tháng</p>
                            <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{item.label}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-black text-gray-900 dark:text-slate-100 tabular-nums">{formatCurrency(item.principal + item.interest)}₫</p>
                              <ChevronRightIcon size={14} className="text-gray-300 opacity-50 flex-shrink-0" />
                            </div>
                            <div className="flex justify-between mt-1">
                              <p className="text-[9px] font-medium text-gray-500 tabular-nums">Gốc: {formatCurrency(item.principal)}</p>
                              <p className="text-[9px] text-emerald-600 font-bold tabular-nums">Lãi: +{formatCurrency(item.interest)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInvestTab = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-8 mb-2">
        <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-5 lg:p-8 shadow-sm border border-purple-100 dark:border-indigo-900/30">
        <p className="text-[10px] lg:text-xs font-bold text-purple-500 dark:text-indigo-400 uppercase tracking-widest mb-2">Tài sản ròng (Equity)</p>
        <p className="text-xl lg:text-3xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(totalInvestmentNet)} ₫</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-5 lg:p-8 shadow-sm border border-purple-50 dark:border-white/5">
          <p className="text-[10px] lg:text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Tổng thị trường</p>
          <p className="text-xl lg:text-3xl font-black text-gray-600 dark:text-slate-400">{formatCurrency(totalInvestmentMarketValue)} ₫</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">Tài sản đang giữ</h3>
          <button onClick={() => setIsAddInvestOpen(true)} className="w-8 h-8 rounded-full bg-purple-100 dark:bg-indigo-900/30 text-purple-600 dark:text-indigo-400 flex items-center justify-center font-bold active:scale-95 transition-transform"><Plus size={18} /></button>
        </div>
        
        {investments.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Chưa có tài sản đầu tư nào.</p>}
        {investments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-8">
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
    const total = Number(loan?.total_amount) || Number(loan?.principal_amount) || 1;
    const remaining = Number(loan?.remaining_principal) ?? total;
    const progress = Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100))) || 0;
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
                Lãi suất: {toViDecimal(loan.interest_rate)}%/năm
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

  // --- Tab Nợ vay ---
  const renderLoansTab = () => {
    if (loansLoading) return null;

    return (
      <div className="space-y-8">
        {/* Card tổng dư nợ */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 shadow-sm border border-red-50 dark:border-rose-900/30">
          <p className="text-[10px] lg:text-xs font-bold text-red-500 dark:text-rose-400 uppercase tracking-widest mb-2">Tổng dư nợ</p>
          <p className="text-3xl lg:text-5xl font-black text-gray-900 dark:text-slate-100">{totalLoanRemaining > 0 ? '-' : ''}{formatCurrency(totalLoanRemaining)} ₫</p>
        </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-8">
            {activeLoans.map(renderLoanCard)}
          </div>
        )}
        
        {paidOffLoans.length > 0 && (
          <div className="mt-8">
            <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 px-1">Đã tất toán</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-8">
              {paidOffLoans.map(renderLoanCard)}
            </div>
          </div>
        )}
      </div>
    );
  };


  return (
    <>
      <div className="p-4 lg:p-8 safe-top pb-24 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300 max-w-7xl mx-auto">
        <h1 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-slate-100 mb-8 mt-4 px-1 tracking-tight">Tài sản & Tài khoản</h1>
        
        {/* Custom Tabs - 4 tabs */}
        <div className="flex bg-gray-200/60 dark:bg-slate-900 p-1 rounded-xl mb-6">
          <button onClick={() => setActiveTab('cash')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'cash' ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-500'}`}>Tiền mặt</button>
          <button onClick={() => setActiveTab('savings')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'savings' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-slate-500'}`}>Tiết kiệm</button>
          <button onClick={() => setActiveTab('invest')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'invest' ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-slate-500'}`}>Đầu tư</button>
          <button onClick={() => setActiveTab('loans')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'loans' ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-rose-400 shadow-sm' : 'text-gray-500 dark:text-slate-500'}`}>Nợ vay</button>
        </div>

        {loading ? (
           <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div></div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'cash' && renderCashTab()}
            {activeTab === 'savings' && renderSavingsTab()}
            {activeTab === 'invest' && renderInvestTab()}
            {activeTab === 'loans' && renderLoansTab()}
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
      <LoanDetailSheet isOpen={isLoanDetailOpen} onClose={() => setIsLoanDetailOpen(false)} loan={selectedLoan ? loans.find(l => l.id === selectedLoan.id) || selectedLoan : null} onUpdated={fetchLoans} />

      {/* Sheet chi tiết danh sách sổ tiết kiệm (mở từ phần Phân tích Tiết kiệm) */}
      <BottomSheet
        isOpen={detailSheet.isOpen}
        onClose={() => setDetailSheet(prev => ({ ...prev, isOpen: false }))}
        title={detailSheet.title}
      >
        <div className="space-y-4 pb-10">
          {detailSheet.books.map((book, idx) => (
            <div key={book.id || idx} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-transparent dark:border-white/5">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-bold text-gray-900 dark:text-slate-100 text-sm">{book.name}</h4>
                <div className="bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded-lg text-[9px] font-black text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 whitespace-nowrap ml-2">
                  {toViDecimal(book.interest_rate)}% / năm
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tiền gốc</p>
                  <p className="font-black text-gray-900 dark:text-slate-100 tabular-nums">{formatCurrency(book.principal_amount)}₫</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Lãi dự kiến</p>
                  <p className="font-black text-emerald-600 tabular-nums">+{formatCurrency(computeSavingsMath(book).expectedTotalInterest)}₫</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Ngày gửi</p>
                  <p className="font-bold text-gray-600 dark:text-slate-400">{book.start_date ? formatDate(book.start_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Ngày đáo hạn</p>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">{book.maturity_date ? formatDate(book.maturity_date) : '—'}</p>
                </div>
              </div>
            </div>
          ))}
          {detailSheet.books.length === 0 && (
            <div className="text-center py-10 text-gray-400 italic">Không có dữ liệu sổ tiết kiệm</div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
