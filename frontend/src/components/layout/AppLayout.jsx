import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { BottomTabBar } from './BottomTabBar';
import { SidebarNav } from './SidebarNav';
import { DesktopWidgets } from './DesktopWidgets';
import { GlobalAddTransactionFab } from './GlobalAddTransactionFab';

/**
 * AppLayout handles the 3-column responsive structure:
 * - Mobile: Single column + Bottom Tab Bar
 * - Desktop: Sidebar (Left) + Main Content (Center) + Widgets (Right)
 */
export function AppLayout() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const captureSnapshot = async () => {
      try {
        const allSavings = await db.savings.toArray();
        const allCategories = await db.categories.toArray();
        const activeSavings = allSavings.filter(s => s.status === 'active');
        
        // Cùng logic với Plan.jsx: Chỉ lấy các sổ thuộc danh mục "Tiết kiệm"
        const currentTotalSavings = activeSavings.reduce((s, x) => {
          const cat = allCategories.find(c => c.id === x.category_id);
          if (cat && cat.name.toLowerCase() === 'tiết kiệm') {
            return s + (parseFloat(x.principal_amount) || 0);
          }
          return s;
        }, 0);

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const key = `actual_total_savings_map_${user.id}`;
        
        const setting = await db.settings.get(key);
        let map = setting ? setting.value : {};

        // Nếu tháng này chưa được set hoặc đang là auto (không bị khóa bởi user)
        if (!map[currentMonth] || !map[currentMonth].isManual) {
          map[currentMonth] = {
            amount: currentTotalSavings,
            isManual: false
          };
          
          await db.settings.put({ key: key, value: map });
        }
      } catch (err) {
        console.error('Error capturing savings snapshot:', err);
      }
    };

    captureSnapshot();
  }, [user]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex transition-colors duration-300">
      
      {/* 1. Sidebar (Desktop Only) */}
      <SidebarNav />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex justify-center">
        {/* Mobile Constraint Wrapper - Only applies on small screens */}
        <div className="w-full max-w-md lg:max-w-none bg-white dark:bg-slate-950 min-h-screen relative shadow-sm lg:shadow-none flex flex-col transition-colors duration-300">
          
          <main className="flex-1 overflow-y-auto pb-[calc(80px+env(safe-area-inset-bottom,0px))] lg:pb-0 dark:text-slate-100">
            <Outlet />
          </main>
          
          {/* Bottom Tab Bar (Mobile Only) */}
          <div className="lg:hidden">
            <BottomTabBar />
          </div>
        </div>
      </div>

      {/* 3. Widgets Panel (Desktop Only) */}
      <DesktopWidgets />

      {/* Nút "+" thêm giao dịch toàn cục (hiển thị ở mọi trang trong layout) */}
      <GlobalAddTransactionFab />

    </div>
  );
}
