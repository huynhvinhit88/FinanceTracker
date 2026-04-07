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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 pb-safe">
      <div className="flex items-center justify-between px-6 pt-2 pb-1 max-w-md mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center space-y-1 w-16 transition-colors',
                  isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                )
              }
            >
              <Icon size={24} className="mb-0.5" strokeWidth={2} />
              <span className="text-[10px] font-medium">{tab.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
