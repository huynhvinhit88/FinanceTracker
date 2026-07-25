import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, Wallet, PieChart, BarChart3, User, StickyNote,
  ChevronRight, LogOut, ShieldCheck 
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
  { name: 'Ghi chú', path: '/notes', icon: StickyNote, desc: 'Ghi nhớ & Việc cần làm' },
  { name: 'Cài đặt', path: '/settings', icon: User, desc: 'Cấu hình ứng dụng' },
];
export function SidebarNav() {
  const { user, signOut } = useAuth();
  const userName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest';

  return (
    <aside className="hidden lg:flex flex-col w-[280px] h-screen sticky top-0 bg-white dark:bg-slate-800/70 dark:backdrop-blur-xl border-r border-gray-100 dark:border-white/10 z-50 transition-colors duration-300">
      {/* Brand / Logo */}
      <div className="p-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Finance Tracker Logo" className="w-full h-full object-contain rounded-xl shadow-lg" />
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
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shadow-sm dark:shadow-indigo-500/10' 
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
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
      <div className="p-6 border-t border-gray-50 dark:border-white/10">
        <div className="mb-6 p-2">
          <p className="text-[10px] text-gray-400 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Xác thực bởi</p>
          <p className="text-sm font-black text-gray-900 dark:text-slate-100 truncate">{userName}</p>
        </div>

        <button 
          onClick={() => signOut()}
          className="w-full flex items-center justify-center space-x-2 py-3 rounded-2xl bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 text-xs font-bold hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 transition-all active:scale-95 border border-transparent hover:border-amber-100 dark:hover:border-amber-500/20"
        >
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
