import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';

/**
 * MobileLayout enforces a mobile constraint wrapper 
 * and handles the safe area for modern notched phones.
 */
export function MobileLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex justify-center transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 min-h-screen relative shadow-sm flex flex-col transition-colors duration-300">
        <main className="flex-1 overflow-y-auto pb-[calc(80px+env(safe-area-inset-bottom,0px))] dark:text-slate-100">
          {/* SafeArea is automatically handled if we use viewport-fit=cover in general */}
          <Outlet />
        </main>
        
        {/* FAB placeholder can go here globally or in specific pages */}

        <BottomTabBar />
      </div>
    </div>
  );
}
