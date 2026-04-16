import React from 'react';
import { Home, Wallet, PieChart, BarChart3, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const TABS = [
  { name: 'Tổng quan', path: '/', icon: Home },
  { name: 'Tài khoản', path: '/accounts', icon: Wallet },
  { name: 'Kế hoạch', path: '/plan', icon: PieChart },
  { name: 'Thống kê', path: '/statistics', icon: BarChart3 },
  { name: 'Cài đặt', path: '/settings', icon: User },
];

export function BottomTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-gray-100 dark:border-white/5 pb-safe shadow-[0_-8px_25px_rgba(0,0,0,0.08)] select-none transition-all duration-300">
      <div className="flex items-stretch justify-around h-16 max-w-md mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-stretch flex-1 h-full transition-all active:bg-gray-50/80 dark:active:bg-slate-800/20 cursor-pointer relative',
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
                )
              }
            >
              {({ isActive }) => (
                <div className="flex flex-col items-center justify-center w-full h-full pt-1">
                  <div className={cn(
                    "p-2 rounded-2xl transition-all duration-200",
                    isActive ? "bg-blue-50 dark:bg-blue-900/30" : ""
                  )}>
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold tracking-tight uppercase mt-0.5",
                    isActive ? "opacity-100" : "opacity-60"
                  )}>
                    {tab.name}
                  </span>

                  {/* Indicator Line for Active Tab */}
                  {isActive && (
                    <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
