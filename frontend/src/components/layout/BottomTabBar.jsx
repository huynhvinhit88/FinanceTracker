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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-gray-100 pb-safe shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.05)] select-none">
      <div className="flex items-center justify-between px-2 pt-3 pb-2 max-w-md mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center space-y-1 h-12 flex-1 transition-all active:scale-90 tap-highlight-transparent',
                  isActive ? 'text-blue-600' : 'text-gray-400'
                )
              }
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-colors",
                "active:bg-gray-100"
              )}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[9px] font-bold tracking-tight uppercase",
                isActive ? "opacity-100" : "opacity-60"
              )}>
                {tab.name}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
