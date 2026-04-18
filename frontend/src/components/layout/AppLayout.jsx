import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';
import { SidebarNav } from './SidebarNav';
import { DesktopWidgets } from './DesktopWidgets';

/**
 * AppLayout handles the 3-column responsive structure:
 * - Mobile: Single column + Bottom Tab Bar
 * - Desktop: Sidebar (Left) + Main Content (Center) + Widgets (Right)
 */
export function AppLayout() {
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

    </div>
  );
}
