import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/db';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/format';
import { Target, TrendingUp, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DesktopWidgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWidgetData();
    }
  }, [user]);

  const fetchWidgetData = async () => {
    try {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);
      
      const [catData, budData, txData] = await Promise.all([
        db.categories.toArray(),
        db.budgets.toArray(),
        db.transactions.filter(tx => tx.date.startsWith(currentMonth)).toArray()
      ]);

      setCategories(catData);
      setBudgets(budData);
      setTransactions(txData);
    } catch (err) {
      console.error("Widget fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const budgetProgress = useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    
    // Total income/expense budgets for the current month (including default)
    const monthlyBudgets = budgets.filter(b => b.month === currentMonth || !b.month);
    
    // Group budgets by category
    const expenseBudgets = monthlyBudgets.filter(b => {
      const cat = categories.find(c => c.id === b.category_id);
      return cat?.type === 'expense';
    });

    return expenseBudgets.map(b => {
      const cat = categories.find(c => c.id === b.category_id);
      const spent = transactions
        .filter(tx => tx.category_id === b.category_id)
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      return {
        id: b.id,
        name: cat?.name || 'Khác',
        icon: cat?.icon || '📌',
        limit: b.amount,
        spent: spent,
        percent: b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0
      };
    }).sort((a, b) => b.percent - a.percent).slice(0, 3);
  }, [budgets, categories, transactions]);

  if (loading) return null;

  return (
    <aside className="hidden xl:flex flex-col w-[320px] h-screen sticky top-0 bg-gray-50/50 dark:bg-slate-900/10 border-l border-gray-100 dark:border-white/5 p-6 overflow-y-auto transition-colors duration-300">
      <div className="space-y-8">
        

        {/* Budget Progress Widget */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center">
              <Target size={14} className="mr-2 text-rose-500" /> Ngân sách tháng
            </h3>
            <Link to="/plan" className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline">Chi tiết</Link>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-gray-50 dark:border-white/5 shadow-sm space-y-4">
            {budgetProgress.length === 0 ? (
              <p className="text-[10px] text-gray-400 text-center italic py-2">Chưa lập kế hoạch chi tiêu</p>
            ) : budgetProgress.map(b => (
              <div key={b.id} className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-gray-700 dark:text-slate-300 flex items-center">
                    <span className="mr-1">{b.icon}</span> {b.name}
                  </span>
                  <span className={b.percent >= 90 ? 'text-rose-500' : 'text-gray-400'}>{Math.round(b.percent)}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-50 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${b.percent >= 100 ? 'bg-rose-500' : b.percent >= 80 ? 'bg-orange-500' : 'bg-indigo-500'}`}
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Insights */}
        <div className="p-5 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Ghi chú nhanh</p>
          <p className="text-xs font-medium leading-relaxed italic opacity-90">
            "Tiết kiệm là nền tảng của tự do tài chính. Hãy bắt đầu từ những khoản nhỏ nhất."
          </p>
        </div>

      </div>
    </aside>
  );
}
