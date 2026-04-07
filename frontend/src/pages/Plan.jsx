import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Target, PiggyBank, HandCoins, TrendingUp, TrendingDown, Activity, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [actualExpenses, setActualExpenses] = useState({});
  const [actualIncome, setActualIncome] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [savingsPlan, setSavingsPlan] = useState({});
  
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Projection States
  const [currentNW, setCurrentNW] = useState(0);
  const [expectedAnnualReturn, setExpectedAnnualReturn] = useState(0); // VND amount
  const [projectionMonths, setProjectionMonths] = useState(12);
  const [showPlanTable, setShowPlanTable] = useState(false);
  const { displayValue: displayManualSaving, value: manualSaving, handleInputChange: handleManualSavingChange, setExternalValue: setManualSaving } = useCurrencyInput('');

  useEffect(() => {
    fetchAllData();
  }, [user]);

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
      const currentMonthStr = new Date().toISOString().slice(0, 7);

      const [budgetRes, txRes, accRes, savRes, invRes] = await Promise.all([
        supabase.from('budgets').select('id, amount, category_id, category:categories(name, icon, color_hex, type)'),
        supabase.from('transactions').select('category_id, amount, type').gte('date', `${currentMonthStr}-01T00:00:00.000Z`),
        supabase.from('accounts').select('balance, sub_type'),
        supabase.from('savings').select('principal_amount, interest_rate').eq('status', 'active'),
        supabase.from('investments').select('current_price, quantity, purchase_price, purchase_date, loan_amount, type')
      ]);

      // 1. Budgets & Actuals
      const allBudgets = budgetRes.data || [];
      const expenses = allBudgets.filter(b => b.category?.type === 'expense');
      const incomes = allBudgets.filter(b => b.category?.type === 'income');
      setExpenseBudgets(expenses);
      setIncomeBudgets(incomes);

      const spentByCat = {};
      const earnedByCat = {};
      (txRes.data || []).forEach(tx => {
        if (tx.type === 'expense') spentByCat[tx.category_id] = (spentByCat[tx.category_id] || 0) + tx.amount;
        else if (tx.type === 'income') earnedByCat[tx.category_id] = (earnedByCat[tx.category_id] || 0) + tx.amount;
      });
      setActualExpenses(spentByCat);
      setActualIncome(earnedByCat);

      // 2. Net Worth Calculation (Excluding Goals)
      const accNW = (accRes.data || []).reduce((s, a) => a.sub_type === 'debt' ? s - a.balance : s + a.balance, 0);
      const savTotal = (savRes.data || []).reduce((s, x) => s + x.principal_amount, 0);
      const invTotal = (invRes.data || []).reduce((s, i) => {
        if (i.type === 'real_estate') return s + (i.current_price - (i.loan_amount || 0));
        return s + (i.current_price * i.quantity);
      }, 0);
      const activeNW = accNW + savTotal + invTotal;
      setCurrentNW(activeNW);

      // 3. Expected Annual Return Amount
      // Sav: prin * rate
      const savAnnualInterest = (savRes.data || []).reduce((s, x) => s + (x.principal_amount * (parseFloat(x.interest_rate) || 0) / 100), 0);
      
      // Inv: Cap gains (estimated based on historical performance if possible)
      let invAnnualGain = 0;
      for (const inv of (invRes.data || [])) {
        const isRE = inv.type === 'real_estate';
        const cost = (inv.purchase_price || inv.current_price) * (isRE ? 1 : inv.quantity);
        const cur = inv.current_price * (isRE ? 1 : inv.quantity);
        const yrs = inv.purchase_date
          ? Math.max(0.083, (Date.now() - new Date(inv.purchase_date)) / (365.25 * 24 * 3600 * 1000))
          : 1;
        
        if (cost > 0) invAnnualGain += cost * (Math.pow(Math.max(0.001, cur / cost), 1 / yrs) - 1);
      }
      
      setExpectedAnnualReturn(savAnnualInterest + invAnnualGain);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanClick = (p) => {
    setSelectedPlan(p);
    setIsEditPlanOpen(true);
  };

  // Monthly Savings calculation: Income - Expense
  const totalIncomePlan = incomeBudgets.reduce((s, b) => s + b.amount, 0);
  const totalExpensePlan = expenseBudgets.reduce((s, b) => s + b.amount, 0);
  const calculatedBaselineSaving = Math.max(0, totalIncomePlan - totalExpensePlan);

  // Use manual saving if edited, else use baseline
  const activeMonthlySaving = manualSaving !== '' ? manualSaving : calculatedBaselineSaving;

  // Projection Logic
  const weightedAnnualRate = currentNW > 0 ? (expectedAnnualReturn / currentNW) : 0.08; // Default 8% if NW=0
  const monthlyRate = weightedAnnualRate / 12;
  
  let projectedNW = currentNW;
  const baseDate = new Date(); baseDate.setDate(1);
  for (let i = 1; i <= projectionMonths; i++) {
    const d = new Date(baseDate); d.setMonth(d.getMonth() + i);
    const key = d.toISOString().slice(0, 7);
    const savingOverride = savingsPlan[key];
    const saving = savingOverride !== undefined ? savingOverride : activeMonthlySaving;
    projectedNW = projectedNW * (1 + monthlyRate) + saving;
  }
  const growthX = currentNW > 0 ? projectedNW / currentNW : 0;
  const totalGain = projectedNW - currentNW;

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

  const renderPlanList = (plans, actuals, type) => {
    if (plans.length === 0) {
      return (
        <div className="text-center py-6 bg-white rounded-3xl border border-dashed border-gray-200 mt-2">
          <p className="text-gray-400 text-xs italic">Chưa lập kế hoạch {type === 'expense' ? 'chi tiêu' : 'thu nhập'}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {plans.map((p) => {
          const actualVal = actuals[p.category_id] || 0;
          const targetVal = p.amount;
          const percentage = Math.min((actualVal / targetVal) * 100, 100);
          
          let progressColor = type === 'expense' ? 'bg-blue-500' : 'bg-emerald-500';
          if (type === 'expense' && percentage >= 100) progressColor = 'bg-red-500';
          else if (type === 'expense' && percentage >= 80) progressColor = 'bg-orange-500';

          return (
            <div 
              key={p.id} 
              onClick={() => handlePlanClick(p)}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-xl" style={{ backgroundColor: p.category?.color_hex }}>
                    {p.category?.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm leading-tight">{p.category?.name}</h4>
                    <p className="text-[10px] font-medium text-gray-500 mt-0.5">{type === 'expense' ? 'Đã chi' : 'Tiến độ'} {Math.round(percentage)}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm leading-tight ${type === 'expense' && percentage >= 100 ? 'text-red-500' : 'text-gray-900'}`}>
                    {formatCurrency(actualVal)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">/ {formatCurrency(targetVal)} đ</p>
                </div>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
                <div 
                  className={`absolute top-0 left-0 h-full ${progressColor} rounded-full transition-all duration-1000 ease-out`} 
                  style={{ width: `${percentage}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="p-4 safe-top pb-24 min-h-screen bg-gray-50">
        <div className="flex justify-between items-center mb-6 mt-4 px-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kế hoạch tài chính</h1>
          <button 
            onClick={() => setIsAddPlanOpen(true)}
            className="p-2 bg-gray-900 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* --- SECTION: INCOME PLAN --- */}
        <section className="mb-8">
          <div className="flex items-center space-x-2 mb-4 px-1">
            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
              <TrendingUp size={18} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Dự thu hàng tháng</h2>
          </div>
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="w-6 h-6 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          ) : renderPlanList(incomeBudgets, actualIncome, 'income')}
        </section>

        {/* --- SECTION: EXPENSE BUDGETS --- */}
        <section className="mb-10">
          <div className="flex items-center space-x-2 mb-4 px-1">
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
              <TrendingDown size={18} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Dự chi (Ngân sách)</h2>
          </div>
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : renderPlanList(expenseBudgets, actualExpenses, 'expense')}
        </section>

        {/* --- SECTION: FINANCIAL PROJECTION (CỖ MÁY THỜI GIAN) --- */}
        <section className="mb-10 pt-6 border-t border-gray-100">
          <div className="flex items-center space-x-2 mb-4 px-1">
            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
              <Activity size={18} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Dự báo tài chính tương lai</h2>
          </div>

          <div className="space-y-5">
            {/* Input Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tích luỹ hàng tháng</label>
                <div className="flex items-baseline space-x-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualSaving === '' ? formatCurrency(calculatedBaselineSaving) : displayManualSaving}
                    onChange={handleManualSavingChange}
                    className={`bg-transparent font-black text-lg outline-none w-full ${manualSaving !== '' ? 'text-indigo-600' : 'text-gray-900'}`}
                    placeholder="0"
                  />
                  <span className="text-xs font-bold text-gray-300">₫</span>
                </div>
                {manualSaving === '' && <p className="text-[9px] text-emerald-500 font-bold mt-1">Lấy từ Dự thu - Dự chi</p>}
                {manualSaving !== '' && (
                  <button onClick={() => setManualSaving('')} className="absolute top-2 right-2 text-[9px] text-gray-400 font-bold underline">Đặt lại</button>
                )}
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Lãi dự thu từ TS hiện có</label>
                <p className="font-black text-lg text-emerald-600">+{fmtLarge(expectedAnnualReturn)}</p>
                <p className="text-[9px] text-gray-400 font-bold mt-1">Dựa trên Sổ tiết kiệm & Đầu tư</p>
              </div>
            </div>

            {/* Year Slider */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-gray-700">Dự báo kế hoạch sau</label>
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md shadow-indigo-100">
                  {Math.floor(projectionMonths / 12)} năm {projectionMonths % 12 > 0 ? `${projectionMonths % 12} th` : ''}
                </span>
              </div>
              <input
                type="range" min="12" max="240" step="12"
                value={projectionMonths}
                onChange={e => setProjectionMonths(parseInt(e.target.value))}
                className="w-full h-2 bg-indigo-50 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-gray-300 mt-2 font-bold px-1">
                <span>1 NĂM</span><span>10 NĂM</span><span>20 NĂM</span>
              </div>
            </div>

            {/* Projection Result Card */}
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
               <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl" />
               
               <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-center opacity-80">Ước tính tài sản ròng dự kiến</p>
               
               <div className="text-center mb-6">
                 <h3 className="text-4xl font-black tracking-tight leading-none mb-2">{fmtLarge(projectedNW)}</h3>
                 <p className="text-indigo-200/60 text-xs font-medium">{formatCurrency(Math.round(projectedNW))} ₫</p>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                   <p className="text-indigo-100/70 text-[9px] font-bold uppercase mb-1">Tỷ suất tăng</p>
                   <p className="font-black text-xl">×{growthX.toFixed(1)}</p>
                   {growthX > 1 && <p className="text-[8px] text-indigo-200 mt-0.5">Tăng {( (growthX - 1) * 100).toFixed(0)}% tải sản</p>}
                 </div>
                 <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-right">
                   <p className="text-indigo-100/70 text-[9px] font-bold uppercase mb-1">Giá trị tích thêm</p>
                   <p className="font-black text-lg text-emerald-300">+{fmtLarge(totalGain)}</p>
                   <p className="text-[8px] text-indigo-200 mt-0.5">Từ lãi & tích luỹ mới</p>
                 </div>
               </div>
            </div>

            {/* Month-by-month override table (Optional/Sheet) */}
            <button
              onClick={() => setShowPlanTable(!showPlanTable)}
              className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 active:scale-[0.98] transition-transform"
            >
              <span>📅 Kế hoạch tiết kiệm từng tháng cụ thể</span>
              {showPlanTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showPlanTable && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 px-4">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i);
                    const m = d.toISOString().slice(0, 7);
                    const val = savingsPlan[m];
                    const [year, month] = m.split('-');
                    
                    return (
                      <div key={m} className="flex items-center justify-between py-3">
                        <span className={`text-xs font-bold ${val ? 'text-indigo-600' : 'text-gray-400'}`}>T{parseInt(month)}/{year}</span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            placeholder={formatCurrency(activeMonthlySaving)}
                            value={val || ''}
                            onChange={(e) => updatePlanMonth(m, e.target.value)}
                            className="text-right text-sm font-black text-gray-800 outline-none w-32"
                          />
                          <span className="text-[10px] text-gray-300 font-bold uppercase">₫</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between">
                  <p className="text-[9px] text-gray-400">Thiết lập này sẽ ưu tiên hơn mặc định</p>
                  {Object.keys(savingsPlan).length > 0 && (
                    <button 
                      onClick={() => { if(window.confirm('Xoá tất cả kế hoạch tháng?')) { setSavingsPlan({}); localStorage.removeItem(`savings_plan_${user.id}`); } }} 
                      className="text-[9px] text-red-400 font-bold"
                    >
                      Xoá tất cả
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <AddBudgetSheet isOpen={isAddPlanOpen} onClose={() => setIsAddPlanOpen(false)} onSuccess={fetchAllData} />
      <EditBudgetSheet 
        isOpen={isEditPlanOpen} 
        onClose={() => setIsEditPlanOpen(false)} 
        budget={selectedPlan} 
        onSuccess={fetchAllData} 
      />
    </>
  );
}
