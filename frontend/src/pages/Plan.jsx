import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { Plus, Target, PiggyBank, HandCoins, TrendingUp, TrendingDown, Activity, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, Settings2 } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { AddBudgetSheet } from '../components/budgets/AddBudgetSheet';
import { EditBudgetSheet } from '../components/budgets/EditBudgetSheet';
import { useCurrencyInput } from '../hooks/useCurrencyInput';

// Helper hiển thị số lớn dạng tỷ/triệu
function fmtLarge(val) {
  if (!val && val !== 0) return '—';
  if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(2).replace('.', ',')} tỷ ₫`;
  if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1).replace('.', ',')} triệu ₫`;
  return `${formatCurrency(val)} ₫`;
}

export default function Plan() {
  const { user } = useAuth();
  
  const [expenseBudgets, setExpenseBudgets] = useState([]);
  const [incomeBudgets, setIncomeBudgets] = useState([]);
  const [rawBudgets, setRawBudgets] = useState([]);
  const [actualExpenses, setActualExpenses] = useState({});
  const [actualIncome, setActualIncome] = useState({});
  
  const [planViewMode, setPlanViewMode] = useState('monthly'); // 'monthly' or 'default'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [loading, setLoading] = useState(true);
  const [savingsPlan, setSavingsPlan] = useState({});
  
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Projection States
  const [currentNW, setCurrentNW] = useState(0);
  const [expectedAnnualReturn, setExpectedAnnualReturn] = useState(0); // VND amount
  const [projectionMonths, setProjectionMonths] = useState(12);
  const [targetProjectionMonth, setTargetProjectionMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-12`;
  });
  const [showPlanTable, setShowPlanTable] = useState(false);
  const { displayValue: displayManualSaving, value: manualSaving, handleInputChange: handleManualSavingChange, setExternalValue: setManualSaving } = useCurrencyInput('');

  useEffect(() => {
    const [tYear, tMonth] = targetProjectionMonth.split('-').map(Number);
    const now = new Date();
    const cYear = now.getFullYear();
    const cMonth = now.getMonth() + 1; // 1-indexed
    
    const diff = (tYear - cYear) * 12 + (tMonth - cMonth);
    setProjectionMonths(Math.max(1, diff));
  }, [targetProjectionMonth]);

  useEffect(() => {
    fetchAllData();
  }, [user, planViewMode, selectedMonth]);

  // Load monthly savings plan from localStorage
  useEffect(() => {
    if (!user) return;
    const planKey = `savings_plan_${user.id}`;
    const stored = localStorage.getItem(planKey);
    if (stored) {
      try { setSavingsPlan(JSON.parse(stored)); } catch (e) {}
    }
  }, [user]);

  const fetchAllData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Logic resolution:
      // If planViewMode is 'default', we only care about budgets with month = null
      // If planViewMode is 'monthly', we prefer budgets with month = selectedMonth, then fallback to month = null
      
      const allTxRaw = await db.transactions
        .filter(tx => tx.date.startsWith(selectedMonth))
        .toArray();

      const allCategories = await db.categories.toArray();
      const allBudgetsRaw = await db.budgets.toArray();
      
      const allBudgets = allBudgetsRaw.map(b => ({
        ...b,
        category: allCategories.find(c => c.id === b.category_id)
      }));

      const allAccounts = await db.accounts.toArray();
      const activeSavings = await db.savings.filter(s => s.status === 'active').toArray();
      const allInvestments = await db.investments.toArray();

      setRawBudgets(allBudgets);

      const processBudgets = (type) => {
        // Filter by type
        const filteredByCat = {};
        allBudgets.forEach(b => {
          if (b.category?.type === type) {
            if (!filteredByCat[b.category_id]) filteredByCat[b.category_id] = { meta: b.category, entries: [] };
            filteredByCat[b.category_id].entries.push(b);
          }
        });

        return Object.keys(filteredByCat).map(catId => {
          const catGroup = filteredByCat[catId];
          let targetEntry = null;

          if (planViewMode === 'default') {
            targetEntry = catGroup.entries.find(e => !e.month);
            // If viewing Default and no default entry exists, we could show a placeholder
            if (!targetEntry) return null; 
          } else {
            // Monthly Mode
            const monthSpecific = catGroup.entries.find(e => e.month === selectedMonth);
            const defaultEntry = catGroup.entries.find(e => !e.month);
            targetEntry = monthSpecific || defaultEntry;

            if (!targetEntry) return null;

            return {
              ...targetEntry,
              is_default: !monthSpecific && !!defaultEntry,
              displayAmount: parseFloat(targetEntry.amount) || 0
            };
          }

          return {
            ...targetEntry,
            is_default: !targetEntry.month,
            displayAmount: parseFloat(targetEntry.amount) || 0
          };
        }).filter(Boolean);
      };

      setExpenseBudgets(processBudgets('expense'));
      setIncomeBudgets(processBudgets('income'));

      // 2. Process Transactions (only if viewing monthly)
      const spentByCat = {};
      const earnedByCat = {};
      allTxRaw.forEach(tx => {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.type === 'expense') spentByCat[tx.category_id] = (spentByCat[tx.category_id] || 0) + amt;
        else if (tx.type === 'income') earnedByCat[tx.category_id] = (earnedByCat[tx.category_id] || 0) + amt;
      });
      setActualExpenses(spentByCat);
      setActualIncome(earnedByCat);

      // 3. Asset Processing
      const accNW = allAccounts.reduce((s, a) => {
        const bal = parseFloat(a.balance) || 0;
        return a.sub_type === 'debt' ? s - bal : s + bal;
      }, 0);
      const savTotal = activeSavings.reduce((s, x) => s + (parseFloat(x.principal_amount) || 0), 0);
      const invTotal = allInvestments.reduce((s, i) => {
        const cur = parseFloat(i.current_price) || 0;
        const qty = parseFloat(i.quantity) || 1;
        const loan = parseFloat(i.loan_amount) || 0;
        if (i.type === 'real_estate') return s + (cur - loan);
        return s + (cur * qty);
      }, 0);
      setCurrentNW(accNW + savTotal + invTotal);

      const savAnnualInterest = activeSavings.reduce((s, x) => s + ((parseFloat(x.principal_amount) || 0) * (parseFloat(x.interest_rate) || 0) / 100), 0);
      let invAnnualGain = 0;
      for (const inv of allInvestments) {
        const isRE = inv.type === 'real_estate';
        const cost = (parseFloat(inv.buy_price) || parseFloat(inv.current_price) || 0) * (isRE ? 1 : (parseFloat(inv.quantity) || 0));
        const cur = (parseFloat(inv.current_price) || 0) * (isRE ? 1 : (parseFloat(inv.quantity) || 0));
        const yrs = inv.purchase_date ? Math.max(0.083, (Date.now() - new Date(inv.purchase_date)) / (365.25 * 24 * 3600 * 1000)) : 1;
        if (cost > 0 && !isNaN(yrs)) invAnnualGain += cost * (Math.pow(Math.max(0.001, cur / cost), 1 / yrs) - 1);
      }
      setExpectedAnnualReturn(savAnnualInterest + invAnnualGain);

    } catch (err) {
      console.error("Plan Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanClick = (p) => {
    setSelectedPlan(p);
    setIsEditPlanOpen(true);
  };

  // Robust Calculations with useMemo
  const { totalIncomePlan, totalExpensePlan, activeMonthlySaving, projectedNW, growthX, totalGain, calculateMonthlyStats } = React.useMemo(() => {
    const getStatsForMonth = (mKey) => {
      const grouped = {};
      (rawBudgets || []).forEach(b => {
        if (!grouped[b.category_id]) grouped[b.category_id] = { type: b.category?.type, entries: [] };
        grouped[b.category_id].entries.push(b);
      });

      let inc = 0;
      let exp = 0;

      Object.keys(grouped).forEach(catId => {
        const catGroup = grouped[catId];
        const monthSpecific = catGroup.entries.find(e => e.month === mKey);
        const defaultEntry = catGroup.entries.find(e => !e.month);
        
        const amt = monthSpecific ? parseFloat(monthSpecific.amount) : (defaultEntry ? parseFloat(defaultEntry.amount) : 0);

        if (catGroup.type === 'income') inc += amt;
        else if (catGroup.type === 'expense') exp += amt;
      });

      return { income: inc, expense: exp, surplus: Math.max(0, inc - exp) };
    };

    const currentStatus = getStatsForMonth(selectedMonth);
    const activeSaving = currentStatus.surplus;
    const weightedAnnualRate = currentNW > 0 ? (expectedAnnualReturn / currentNW) : 0.08;
    const monthlyRate = weightedAnnualRate / 12;

    let pNW = currentNW;
    const baseDate = new Date(); baseDate.setDate(1);
    for (let i = 1; i <= (projectionMonths || 12); i++) {
      const d = new Date(baseDate); d.setMonth(d.getMonth() + i);
      const key = d.toISOString().slice(0, 7);
      const override = savingsPlan[key];
      
      const monthData = getStatsForMonth(key);
      const sVal = override !== undefined ? override : monthData.surplus;
      
      pNW = pNW * (1 + (monthlyRate || 0)) + Math.max(0, sVal || 0);
    }

    return {
      totalIncomePlan: currentStatus.income,
      totalExpensePlan: currentStatus.expense,
      activeMonthlySaving: activeSaving,
      projectedNW: pNW,
      growthX: currentNW > 0 ? pNW / currentNW : 0,
      totalGain: pNW - currentNW,
      calculateMonthlyStats: (m) => getStatsForMonth(m)
    };
  }, [rawBudgets, currentNW, expectedAnnualReturn, projectionMonths, savingsPlan, selectedMonth]);

  const updatePlanMonth = (month, rawInput) => {
    const planKey = `savings_plan_${user.id}`;
    const newPlan = { ...savingsPlan };
    if (rawInput === '' || rawInput === null) {
      delete newPlan[month];
    } else {
      const val = parseFloat(rawInput);
      if (!isNaN(val)) newPlan[month] = val;
    }
    setSavingsPlan(newPlan);
    localStorage.setItem(planKey, JSON.stringify(newPlan));
  };

  // Month Navigator Helpers
  const changeMonth = (offset) => {
    const d = new Date(selectedMonth + '-02');
    d.setMonth(d.getMonth() + offset);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const renderPlanList = (plans, actuals, type) => {
    if (plans.length === 0) {
      return (
        <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-200 dark:border-white/10 mt-2">
          <p className="text-gray-400 dark:text-slate-500 text-xs italic">Chưa lập kế hoạch {type === 'expense' ? 'chi tiêu' : 'thu nhập'} {planViewMode === 'default' ? 'mặc định' : ''}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {plans.map((p) => {
          const actualVal = actuals[p.category_id] || 0;
          const targetVal = p.amount;
          const percentage = targetVal > 0 ? Math.min((actualVal / targetVal) * 100, 100) : 0;
          
          let progressColor = type === 'expense' ? 'bg-blue-500' : 'bg-emerald-500';
          if (type === 'expense' && percentage >= 100) progressColor = 'bg-red-500';
          else if (type === 'expense' && percentage >= 80) progressColor = 'bg-orange-500';

          return (
            <div 
              key={p.id} 
              onClick={() => handlePlanClick(p)}
              className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-slate-800 text-xl" style={{ backgroundColor: p.category?.color_hex + '20', color: p.category?.color_hex }}>
                    {p.category?.icon}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="font-bold text-gray-900 dark:text-slate-100 text-sm leading-tight">{p.category?.name}</h4>
                      {p.is_default && planViewMode === 'monthly' && (
                        <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[8px] font-black px-1 rounded uppercase">MẶC ĐỊNH</span>
                      )}
                    </div>
                    {planViewMode === 'monthly' && (
                      <p className="text-[10px] font-medium text-gray-500 dark:text-slate-500 mt-0.5">{type === 'expense' ? 'Đã chi' : 'Tiến độ'} {Math.round(percentage)}%</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm leading-tight ${type === 'expense' && percentage >= 100 && planViewMode === 'monthly' ? 'text-red-500 dark:text-rose-400' : 'text-gray-900 dark:text-slate-100'}`}>
                    {planViewMode === 'monthly' ? formatCurrency(actualVal) : formatCurrency(targetVal)} {planViewMode === 'monthly' && '₫'}
                  </p>
                  {planViewMode === 'monthly' && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">/ {formatCurrency(targetVal)} đ</p>
                  )}
                  {planViewMode === 'default' && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">/ mỗi tháng</p>
                  )}
                </div>
              </div>
              {planViewMode === 'monthly' && (
                <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden relative mt-1">
                  <div 
                    className={`absolute top-0 left-0 h-full ${progressColor} rounded-full transition-all duration-1000 ease-out`} 
                    style={{ width: `${percentage}%` }} 
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const [year, month] = selectedMonth.split('-');
  const monthLabel = `Tháng ${month}/${year}`;

  return (
    <>
      <div className="px-4 pt-safe pb-32 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        
        {/* --- HEADER & NAVIGATION --- */}
        <div className="mb-6">
          <div className="flex justify-between items-center px-1 mb-4">
            <h1 className="text-2xl font-black text-gray-900 dark:text-slate-100 mt-4 tracking-tight">Kế hoạch</h1>
            <button 
              onClick={() => setIsAddPlanOpen(true)}
              className="w-10 h-10 flex items-center justify-center bg-gray-900 dark:bg-indigo-600 text-white rounded-2xl shadow-lg active:scale-95 transition-transform mt-4"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900/50 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex items-center">
            <button 
              onClick={() => setPlanViewMode('monthly')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-bold transition-all ${planViewMode === 'monthly' ? 'bg-gray-900 dark:bg-slate-800 text-white shadow-md' : 'text-gray-500 dark:text-slate-500'}`}
            >
              <Calendar size={16} />
              <span>Xem theo tháng</span>
            </button>
            <button 
              onClick={() => setPlanViewMode('default')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-bold transition-all ${planViewMode === 'default' ? 'bg-gray-900 dark:bg-slate-800 text-white shadow-md' : 'text-gray-500 dark:text-slate-500'}`}
            >
              <Settings2 size={16} />
              <span>Cấu hình mặc định</span>
            </button>
          </div>

          {planViewMode === 'monthly' && (
            <div className="flex items-center justify-between mt-4 px-1">
              <button 
                onClick={() => changeMonth(-1)}
                className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 text-gray-400 dark:text-slate-500 active:scale-90 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{year}</p>
                <h3 className="text-lg font-black text-indigo-600 dark:text-indigo-400">{monthLabel}</h3>
              </div>
              <button 
                onClick={() => changeMonth(1)}
                className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 text-gray-400 dark:text-slate-500 active:scale-90 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* --- SUMMARY CARD (Only in Monthly Mode) --- */}
        {planViewMode === 'monthly' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-white/5 mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Dự thu</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIncomePlan)} ₫</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Dự chi</p>
                <p className="text-lg font-black text-blue-600 dark:text-blue-400">{formatCurrency(totalExpensePlan)} ₫</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-white/5 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 dark:text-slate-500">Kế hoạch dư ra (Savings)</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(activeMonthlySaving)} ₫</span>
            </div>
          </div>
        )}

        {/* --- SECTION: INCOME PLAN --- */}
        <section className="mb-8">
          <div className="flex items-center space-x-2 mb-4 px-1">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <TrendingUp size={18} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{planViewMode === 'default' ? 'Dự thu mặc định' : 'Dự thu trong tháng'}</h2>
          </div>
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          ) : renderPlanList(incomeBudgets, actualIncome, 'income')}
        </section>

        {/* --- SECTION: EXPENSE BUDGETS --- */}
        <section className="mb-10">
          <div className="flex items-center space-x-2 mb-4 px-1">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <TrendingDown size={18} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{planViewMode === 'default' ? 'Dự chi mặc định' : 'Dự chi trong tháng'}</h2>
          </div>
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-blue-100 dark:border-blue-900/30 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : renderPlanList(expenseBudgets, actualExpenses, 'expense')}
        </section>

        {/* --- SECTION: FINANCIAL PROJECTION --- */}
        <section className="mb-10 pt-6 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center space-x-2 mb-4 px-1">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Activity size={18} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Tương lai & Tích luỹ</h2>
          </div>

          <div className="space-y-4">
             {/* Year Slider */}
             <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-bold text-gray-700 dark:text-slate-300">Dự báo đến mốc</label>
                <input 
                  type="month"
                  value={targetProjectionMonth}
                  onChange={e => setTargetProjectionMonth(e.target.value)}
                  className="bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-xl text-xs font-bold outline-none border-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                Khoảng {Math.floor(projectionMonths / 12)} năm {projectionMonths % 12 > 0 ? `${projectionMonths % 12} tháng` : ''} tính từ hiện tại
              </p>
            </div>

            {/* Result Card */}
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
               
               <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-center opacity-80">Tổng tài sản ròng sau {Math.floor(projectionMonths / 12)} năm</p>
               
               <div className="text-center mb-6">
                 <h3 className="text-4xl font-black tracking-tight leading-none mb-2">{fmtLarge(projectedNW)}</h3>
                 <p className="text-indigo-200/60 text-xs font-medium">{formatCurrency(Math.round(projectedNW))} ₫</p>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                   <p className="text-indigo-100/70 text-[9px] font-bold uppercase mb-1">Tỷ suất tăng</p>
                   <p className="font-black text-xl">×{growthX.toFixed(1)}</p>
                 </div>
                 <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-right">
                   <p className="text-indigo-100/70 text-[9px] font-bold uppercase mb-1">Tích thêm</p>
                   <p className="font-black text-lg text-emerald-300">+{fmtLarge(totalGain)}</p>
                 </div>
               </div>
            </div>

            {/* Table Toggle */}
            <button
              onClick={() => setShowPlanTable(!showPlanTable)}
              className="w-full py-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 text-indigo-600 dark:text-indigo-400 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 active:scale-[0.98] transition-all shadow-sm"
            >
              <Calendar size={14} />
              <span>{showPlanTable ? 'Thu gọn bảng kế hoạch' : 'Chi tiết kế hoạch từng tháng'}</span>
              {showPlanTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showPlanTable && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-white/5 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-center divide-y divide-gray-50 dark:divide-white/5">
                        <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                            <tr>
                                <th className="py-3 px-4 text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase">Tháng</th>
                                <th className="py-3 px-2 text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase">Dự Thu</th>
                                <th className="py-3 px-2 text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase">Dự Chi</th>
                                <th className="py-3 px-4 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Tiết kiệm</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {Array.from({ length: Math.min(60, projectionMonths) }).map((_, i) => {
                                const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i);
                                const m = d.toISOString().slice(0, 7);
                                const overrideVal = savingsPlan[m];
                                const stats = calculateMonthlyStats(m);
                                const finalSavings = overrideVal !== undefined ? overrideVal : stats.surplus;
                                
                                return (
                                <tr key={m} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-black text-gray-900 dark:text-slate-100">T{d.getMonth() + 1}/{d.getFullYear()}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(stats.income)}</td>
                                    <td className="py-3 px-2 text-[10px] font-bold text-blue-600 dark:text-blue-400">-{formatCurrency(stats.expense)}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-center space-x-1">
                                            <input
                                                type="number"
                                                placeholder={formatCurrency(stats.surplus)}
                                                value={overrideVal || ''}
                                                onChange={(e) => updatePlanMonth(m, e.target.value)}
                                                className={`text-center text-xs font-black outline-none w-20 py-1 rounded-lg border border-transparent focus:border-indigo-200 dark:focus:border-indigo-900 bg-transparent ${overrideVal ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-600 opacity-50'}`}
                                            />
                                            <span className="text-[8px] text-gray-300 dark:text-slate-700 font-bold">₫</span>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {projectionMonths > 60 && <div className="p-3 bg-gray-50 dark:bg-slate-800/50 text-center text-[9px] text-gray-400 dark:text-slate-500 italic">Bảng chỉ hiển thị chi tiết 5 năm đầu tiên</div>}
                <div className="p-3 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-white/5 flex justify-between px-6">
                  <p className="text-[9px] text-gray-400 dark:text-slate-500">Ghi chú: Thay đổi cột Tiết kiệm để ghi đè kế hoạch tháng đó</p>
                  {Object.keys(savingsPlan).length > 0 && (
                    <button 
                      onClick={() => { if(window.confirm('Xoá tất cả ghi đè tiết kiệm?')) { setSavingsPlan({}); localStorage.removeItem(`savings_plan_${user.id}`); } }} 
                      className="text-[9px] text-red-500 font-black uppercase tracking-tighter"
                    >
                      Xoá tất cả ghi đè
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <AddBudgetSheet 
        isOpen={isAddPlanOpen} 
        onClose={() => setIsAddPlanOpen(false)} 
        onSuccess={fetchAllData}
        initialMonth={planViewMode === 'monthly' ? selectedMonth : null}
      />
      <EditBudgetSheet 
        isOpen={isEditPlanOpen} 
        onClose={() => setIsEditPlanOpen(false)} 
        budget={selectedPlan} 
        onSuccess={fetchAllData} 
        viewMonth={selectedMonth}
      />
    </>
  );
}
