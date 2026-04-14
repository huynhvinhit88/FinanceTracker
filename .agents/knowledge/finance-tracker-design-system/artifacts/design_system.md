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
6. Bảo mật & Quyền riêng tư (PIN)

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

---

## MobileLayout Constraints
- **Max width**: `max-w-md` (centered on wide screens)
- **Safe area**: Uses `pb-[calc(80px+env(safe-area-inset-bottom,0px))]` for bottom tabs
- **Bottom tab height**: `h-16` (64px) + safe area
- **Page padding**: Pages use `px-4 pt-safe pb-32`

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
