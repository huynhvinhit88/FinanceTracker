import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';

/**
 * MobileLayout enforces a mobile constraint wrapper 
 * and handles the safe area for modern notched phones.
 */
export function MobileLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen relative shadow-sm flex flex-col">
        <main className="flex-1 overflow-y-auto pb-[80px]">
          {/* SafeArea is automatically handled if we use viewport-fit=cover in general */}
          <Outlet />
        </main>
        
        {/* FAB placeholder can go here globally or in specific pages */}

        <BottomTabBar />
      </div>
    </div>
  );
}
