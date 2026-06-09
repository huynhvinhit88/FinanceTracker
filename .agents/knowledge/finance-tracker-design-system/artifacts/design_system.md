# FinanceTracker — Design System & "Deep Space" Dark Mode Guide

## Overview
The app uses **Tailwind CSS v4** with a custom class-based dark mode called the **"Deep Space"** theme.
> **CRITICAL**: Tailwind v4 does NOT auto-detect class-based dark mode. The first line of `src/index.css` (after the `@import`) MUST be:
> ```css
> @custom-variant dark (&:where(.dark, .dark *));
> ```

---

## Theme Configuration

### How Themes Work
1. User toggles via **Settings > Giao diện** (at the bottom of the Settings page, below "Quản lý Dữ liệu").
2. `ThemeContext.toggleTheme()` flips `theme` state between `'light'` and `'dark'`.
3. `useEffect` adds/removes `.dark` class on `document.documentElement`.
4. Saved to `localStorage` key `'theme'`.
5. Tailwind's `dark:` utilities activate via the `@custom-variant` rule.

---

## Color Palette

### Surfaces (Backgrounds)
| Role | Light | Dark |
|---|---|---|
| App background | `bg-gray-50` | `dark:bg-slate-950` |
| Card/Section surface | `bg-white` | `dark:bg-slate-900` |
| Input field | `bg-gray-50` | `dark:bg-slate-800` |
| Hover state | `hover:bg-gray-50` | `dark:hover:bg-slate-800/20` |
| Active (pressed) | `active:bg-gray-100` | `dark:active:bg-slate-800/40` |

### Borders
| Role | Light | Dark |
|---|---|---|
| Card border | `border-gray-100` | `dark:border-white/5` |
| Input border | `border-transparent` | `dark:border-transparent` |
| Divider | `divide-gray-50` | `dark:divide-white/5` |
| Dashed/empty state | `border-gray-200` | `dark:border-white/10` |

### Text
| Role | Light | Dark |
|---|---|---|
| Primary heading | `text-gray-900` | `dark:text-slate-100` |
| Label/secondary | `text-gray-700` | `dark:text-slate-400` |
| Muted/hint | `text-gray-500` | `dark:text-slate-500` |
| Very muted | `text-gray-400` | `dark:text-slate-500` |
| Section header (caps) | `text-gray-400` | `dark:text-slate-500` |

### Financial Data Colors
| Role | Light | Dark |
|---|---|---|
| Income / Positive | `text-emerald-600` | `dark:text-emerald-400` |
| Expense / Negative | `text-red-600` | `dark:text-rose-400` |
| Debt indicator | `text-red-500` | `dark:text-rose-400` |
| Savings / Accent | `text-blue-600` | `dark:text-blue-400` |
| Investment (net) | `text-indigo-600` | `dark:text-indigo-400` |

### Action Colors (Buttons)
| Action | Light | Dark |
|---|---|---|
| Primary action | `bg-blue-600` | `dark:bg-indigo-600` |
| Success/Confirm | `bg-emerald-600` | `dark:bg-emerald-700` |
| Danger/Delete | `bg-red-500` or `text-red-600` | `dark:bg-red-900/20 dark:text-rose-400` |
| Neutral | `bg-gray-900` | `dark:bg-slate-800` |

### Specialized Segment Backgrounds (Dark Mode)
| Role | Color | Usage |
|---|---|---|
| Simulation Profile | `dark:bg-indigo-900/10` | Loan simulation selector |
| Loan Period | `dark:bg-purple-900/10` | Segmented interest/budget list |
| Equity Summary | `dark:bg-emerald-900/10` | Real Estate net equity card |
| Danger Area | `dark:bg-red-900/10` | Delete buttons area |

---

## Component Patterns

### Settings Page Sections
Each settings section follows this pattern:
```jsx
<div>
  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 pl-11">
    Section Label
  </p>
  <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden divide-y divide-gray-50 dark:divide-white/5">
    {/* Row items */}
  </div>
</div>
```

**Settings page section order (top to bottom):**
1. Công cụ & Phân tích (Tính lãi vay, Lãi kép)
2. Tuỳ chỉnh Ứng dụng (Category management)
3. Quản lý Dữ liệu (Export, Import, Wipe)
4. **Giao diện** (Dark mode toggle) ← intentionally placed here
5. Lưu trữ Đám mây (Google Drive)
6. Bảo mật & Quyền riêng tư (Đổi mật khẩu)

### Theme Toggle (Correct Implementation)
```jsx
<button 
  onClick={toggleTheme}
  className={`w-14 h-8 rounded-full transition-all duration-300 flex items-center px-1 relative ${theme === 'dark' ? 'bg-indigo-600 shadow-inner' : 'bg-gray-200'}`}
>
  <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
</button>
```
> **Note**: Use `flex items-center` + `px-1` (NOT `absolute top-1 left-1`) to eliminate vertical misalignment.

### BottomSheet (Base Modal)
- **File**: `src/components/ui/BottomSheet.jsx`
- **Props**: `{ isOpen, onClose, title, children }`
- **Already dark-mode ready**: Uses `dark:bg-slate-900`, `dark:border-white/5`
- **Animation**: Framer Motion spring (`damping: 30, stiffness: 300, mass: 0.8`)
- **Max height**: `max-h-[82vh]` — content scrollable via `overflow-y-auto`
- **⚠️ State does NOT reset on close**: `BottomSheet` only unmounts its *children* (via `AnimatePresence` + `{isOpen && …}`), but the **parent sheet component is usually always-mounted** (e.g. `<LoanCalculatorSheet isOpen={…} />` lives permanently in `Settings.jsx`). So a form's `useState` persists after closing with the X/backdrop — reopening shows the half-edited, never-saved values, which reads as "it saved my changes". **Fix pattern**: reset the form in a `useEffect(..., [isOpen])` when `isOpen` becomes true (reset on open, not on close, to avoid flicker during the exit animation), or wrap `onClose` to clear unsaved state.

```jsx
<BottomSheet isOpen={isOpen} onClose={onClose} title="Sheet Title">
  <form className="space-y-6">
    {/* content */}
  </form>
</BottomSheet>
```

### Input Fields (Dark-aware)
```jsx
{/* Text/Number Input */}
<input
  className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 
             border border-transparent focus:border-blue-500 
             dark:focus:bg-slate-700 rounded-xl px-4 py-3 outline-none transition-all"
/>

{/* Large Amount Input */}
<input
  className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 
             text-3xl font-bold py-4 pr-24 pl-4 rounded-2xl border-none 
             focus:ring-2 focus:ring-blue-500 transition-all outline-none"
/>

{/* Select */}
<select
  className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 
             rounded-xl px-4 py-3 outline-none border border-transparent 
             focus:border-blue-500"
/>
```

### Labels
```jsx
<label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">
  Label text
</label>
```

### Error Banner (in forms)
```jsx
{error && (
  <div className="p-3 bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 
                  rounded-xl text-sm font-medium border border-red-100 dark:border-rose-900/30">
    {error}
  </div>
)}

### Specialized Input Components

#### RateInput (with Vietnamese decimal comma)
Standard for interest rates and percentages:
```jsx
<input
  type="text"
  inputMode="decimal"
  className="w-full bg-white dark:bg-slate-800 
             border border-gray-100 dark:border-white/5 
             text-gray-900 dark:text-slate-100 font-bold"
/>
```

#### Equity Summary Card (Emerald)
```jsx
<div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-4 
                border border-emerald-100 dark:border-emerald-900/30">
   {/* Equity calculation content */}
</div>
```
```

### Submit Button
```jsx
<button
  type="submit"
  disabled={loading}
  className="w-full py-4 mt-2 bg-blue-600 dark:bg-indigo-600 text-white font-semibold 
             rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none 
             active:scale-[0.98] transition-transform flex items-center justify-center"
>
  {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Lưu'}
</button>
```

### Filter / Group Chips (pill toggles)
Horizontal scrollable row of pill buttons for switching a view filter or grouping mode.
The active chip is filled with a solid accent (gray-900/indigo for neutral filters, emerald for
savings-related views); inactive chips are muted surfaces. Used by `TransactionsList.jsx` (type
filter) and the **Tiết kiệm** tab grouping selector in `Accounts.jsx`.
```jsx
<div className="flex space-x-2 overflow-x-auto hide-scrollbar mb-5">
  {options.map(opt => (
    <button
      key={opt.id}
      onClick={() => setValue(opt.id)}
      className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
        value === opt.id
          ? 'bg-emerald-600 text-white shadow-md'           // accent for savings; use bg-gray-900 dark:bg-indigo-600 for neutral
          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
      }`}
    >
      {opt.label}
    </button>
  ))}
</div>
```

### Grouped List Section (header + subtotal)
When a card list is grouped (e.g. savings books by account or by maturity month), each group is a
block with a bold heading on the left and a muted summary on the right (count + subtotal), above the
normal responsive card grid. Subtotals aggregate only the relevant subset (e.g. **active** books).
```jsx
<div className="mb-8">
  <div className="flex items-baseline justify-between mb-3 px-1">
    <h4 className="font-black text-gray-900 dark:text-slate-100 text-base lg:text-lg">{group.label}</h4>
    <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
      {group.items.length} sổ · Gốc: {formatCurrency(group.totalPrincipal)} ₫
    </span>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-8">
    {group.items.map(renderCard)}
  </div>
</div>
```

---

## AppLayout Constraints (`components/layout/AppLayout.jsx`)
> Renamed from the old `MobileLayout`. `AppLayout` is now a **3-column responsive** shell.

- **Mobile**: single centered column (`max-w-md`) + `BottomTabBar` (hidden on `lg`).
- **Desktop (`lg`)**: `SidebarNav` (left) + main content (`lg:max-w-none`) + `DesktopWidgets` (right). Bottom tab bar hidden.
- **Safe area**: main uses `pb-[calc(80px+env(safe-area-inset-bottom,0px))]` on mobile, `lg:pb-0` on desktop.
- **Bottom tab height**: `h-16` (64px) + safe area.
- **Page padding**: Pages use `px-4 pt-safe pb-32`.

---

## Global Add-Transaction FAB (`components/layout/GlobalAddTransactionFab.jsx`)
> Nút "+" thêm giao dịch là **FAB toàn cục**, hiển thị cố định trên **mọi trang**. Được gắn một lần trong `AppLayout` (áp dụng cho Tổng quan / Tài khoản / Kế hoạch / Thống kê / Cài đặt) và gắn lại trong `TransactionsList.jsx` vì trang đó nằm ngoài `AppLayout`. Không đặt FAB riêng trong từng page.

- **Vị trí**: `fixed bottom-24 lg:bottom-8 right-6` — mobile cao hơn `BottomTabBar`, desktop hạ thấp (không có tab dưới).
- **Hình dạng**: `w-14 h-14 rounded-full`, nền `bg-gray-900 dark:bg-indigo-600`, icon `Plus size={28}`, `active:scale-95`.
- **Z-index**: `z-40` — dưới `BottomTabBar` (`z-[100]`) và `BottomSheet` (`z-[200]`) nên không che các lớp đó khi mở.
- **Đồng bộ dữ liệu**: thêm giao dịch thành công → `emitDataChanged()` (event `ft:data-changed`). Các page dùng hook `useGlobalRefresh(callback)` để tự fetch lại số liệu mà không cần điều hướng.

---

## Page-Level Dark Mode Classes
All pages must include these root classes:
```jsx
// Page container
<div className="px-4 pt-safe pb-32 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
```

---

## Chart Dark Mode (Recharts)
Recharts tooltips require manual dark styling (CSS class `dark:` doesn't always penetrate inline styles):
```jsx
<Tooltip
  contentStyle={{ 
    borderRadius: '16px', 
    border: 'none', 
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
    fontSize: '12px',
    backgroundColor: 'var(--tw-bg-opacity, #ffffff)',
    color: 'var(--tw-text-opacity, #1e293b)'
  }}
  className="dark:!bg-slate-800 dark:!text-slate-100"
  formatter={(val) => [`${formatCurrency(val)} ₫`]}
/>
```

---

## Loading Spinners (Themed)
```jsx
{/* Light spinner */}
<div className="w-8 h-8 border-4 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-600 rounded-full animate-spin" />

{/* White spinner (inside colored buttons) */}
<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
```

---

## Specialized Tool UI Patterns (Simulation & Calc)

### 1. Advanced Projection Tables
Used in `LoanCalculatorSheet` to show complex monthly breakdowns.

- **Header**: `bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500`
- **Rows**: `hover:bg-gray-50/50 dark:hover:bg-slate-800/50`
- **Sticky Column**: `bg-white dark:bg-slate-900 shadow-sm`
- **Dividers**: `border-gray-100 dark:border-white/5`

### 2. Result Summary Blocks
Large "wow" factors at the bottom of sheets.

- **Primary Result**: `bg-gray-50 dark:bg-slate-900/50 border-gray-100 dark:border-white/5`
- **Inverse Highlight**: `bg-slate-800 dark:bg-slate-900 text-white`
- **Sub-highlights**: `bg-blue-50 dark:bg-indigo-900/10 text-blue-800 dark:text-indigo-400`
