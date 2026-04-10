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
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-100 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)] select-none">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95 cursor-pointer',
                  isActive ? 'text-blue-600' : 'text-gray-400'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "p-2 rounded-2xl transition-all",
                    isActive ? "bg-blue-50" : ""
                  )}>
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold tracking-tight uppercase mt-0.5",
                    isActive ? "opacity-100" : "opacity-60"
                  )}>
                    {tab.name}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
