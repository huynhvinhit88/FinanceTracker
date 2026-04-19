import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, Wallet, PieChart, BarChart3, User, 
  ChevronRight, Lock, ShieldCheck 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const TABS = [
  { name: 'Tổng quan', path: '/', icon: Home, desc: 'Bảng điều khiển chính' },
  { name: 'Tài khoản', path: '/accounts', icon: Wallet, desc: 'Quản lý ví & tài sản' },
  { name: 'Kế hoạch', path: '/plan', icon: PieChart, desc: 'Ngân sách & dự báo' },
  { name: 'Thống kê', path: '/statistics', icon: BarChart3, desc: 'Báo cáo chi tiết' },
  { name: 'Cài đặt', path: '/settings', icon: User, desc: 'Cấu hình ứng dụng' },
];

export function SidebarNav() {
  const { googleUser, lock } = useAuth();
  const userName = googleUser?.email?.split('@')[0] || 'Guest';

  return (
    <aside className="hidden lg:flex flex-col w-[280px] h-screen sticky top-0 bg-white dark:bg-slate-950 border-r border-gray-100 dark:border-white/5 z-50 transition-colors duration-300">
      {/* Brand / Logo */}
      <div className="p-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900 dark:text-slate-100 tracking-tight leading-none">Finance</h1>
            <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-1">Tracker</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative',
                  isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                    : 'text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-900'
                )
              }
            >
              <Icon size={22} className="shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold tracking-tight">{tab.name}</p>
                <p className="text-[10px] opacity-60 font-medium group-hover:opacity-100 transition-opacity hidden xl:block">{tab.desc}</p>
              </div>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />
              
              {/* Active Indicator */}
              <div className={cn(
                "absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-600 rounded-r-full transition-all duration-300",
                "opacity-0 scale-y-0",
                "group-[.active]:opacity-100 group-[.active]:scale-y-100"
              )} />
            </NavLink>
          );
        })}
      </nav>

      {/* User / Profile Section */}
      <div className="p-6 border-t border-gray-50 dark:border-white/5">
        <div className="mb-6 p-2">
          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Xác thực bởi</p>
          <p className="text-sm font-black text-gray-900 dark:text-slate-100 truncate">{userName}</p>
        </div>

        <button 
          onClick={() => lock()}
          className="w-full flex items-center justify-center space-x-2 py-3 rounded-2xl bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-400 text-xs font-bold hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/20 transition-all active:scale-95 border border-transparent hover:border-amber-100 dark:hover:border-amber-900/50"
        >
          <Lock size={16} />
          <span>Khoá ứng dụng</span>
        </button>
      </div>
    </aside>
  );
}
