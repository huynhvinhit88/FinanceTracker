import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, FolderTree, FileDown, Trash2, ChevronRight, Activity, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CategoryManagementSheet } from '../components/settings/CategoryManagementSheet';
import { LoanCalculatorSheet } from '../components/tools/LoanCalculatorSheet';
import { CompoundInterestSheet } from '../components/tools/CompoundInterestSheet';
import { calculateLoanSchedule } from '../utils/loanCalculator';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);

  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showLoanSheet, setShowLoanSheet] = useState(false);
  const [showCompoundSheet, setShowCompoundSheet] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportSelections, setExportSelections] = useState({
    transactions: true,
    accounts: true,
    goals: true,
    loanProfiles: false,
    projection: false,
  });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) setProfile(data);
  };

  const handleSignOut = async () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      try {
        await signOut();
      } catch (error) {
        console.error('Error signing out', error);
      }
    }
  };

  // Helper: convert array to CSV
  const toCSV = (headers, rows) => {
    const headerLine = headers.join(',');
    const dataLines = rows.map(row => headers.map(h => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    }).join(','));
    return [headerLine, ...dataLines].join('\n');
  };

  const downloadCSV = (content, filename) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportData = async () => {
    if (!Object.values(exportSelections).some(Boolean)) {
      alert('Vui lòng chọn ít nhất 1 loại báo cáo cần xuất.');
      return;
    }
    setExportLoading(true);
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      // --- 1. Giao dịch ---
      if (exportSelections.transactions) {
        const { data } = await supabase.from('transactions').select(`
          id, type, amount, date, note,
          account:accounts!account_id(name),
          to_account:accounts!to_account_id(name),
          category:categories(name)
        `).order('date', { ascending: false });
        const csv = toCSV(
          ['id', 'date', 'type', 'amount', 'account', 'to_account', 'category', 'note'],
          (data || []).map(tx => ({
            id: tx.id,
            date: new Date(tx.date).toLocaleDateString('vi-VN'),
            type: tx.type === 'income' ? 'Thu nhập' : tx.type === 'expense' ? 'Chi tiêu' : 'Chuyển khoản',
            amount: tx.amount,
            account: tx.account?.name || '',
            to_account: tx.to_account?.name || '',
            category: tx.category?.name || '',
            note: tx.note || ''
          }))
        );
        downloadCSV(csv, `FT_GiaoDich_${dateStr}.csv`);
      }

      // --- 2. Tài khoản ---
      if (exportSelections.accounts) {
        const { data } = await supabase.from('accounts').select('name, type, sub_type, balance, currency');
        const csv = toCSV(['name', 'type', 'sub_type', 'balance', 'currency'], data || []);
        downloadCSV(csv, `FT_TaiKhoan_${dateStr}.csv`);
      }

      // --- 3. Mục tiêu ---
      if (exportSelections.goals) {
        const { data } = await supabase.from('goals').select('name, target_amount, current_amount, deadline, status');
        const csv = toCSV(
          ['name', 'target_amount', 'current_amount', 'deadline', 'status'],
          (data || []).map(g => ({
            ...g,
            deadline: g.deadline ? new Date(g.deadline).toLocaleDateString('vi-VN') : '',
            status: g.status === 'completed' ? 'Đã hoàn thành' : 'Đang thực hiện'
          }))
        );
        downloadCSV(csv, `FT_MucTieu_${dateStr}.csv`);
      }

      // --- 4. Hồ sơ Khoản Vay (localStorage) + Bảng dòng tiền ---
      if (exportSelections.loanProfiles) {
        const stored = localStorage.getItem(`loan_profiles_${user?.id || 'guest'}`);
        const profiles = stored ? JSON.parse(stored) : [];
        if (profiles.length === 0) {
          alert('Chưa có hồ sơ khoản vay nào được lưu.');
        } else {
          let csvSections = [
            `# FINANCETRACKER - HỐ SƠ KHOẢN VAY`,
            `# Xuất lúc: ${new Date().toLocaleString('vi-VN')}`,
            `# Tài khoản: ${user?.email}`,
            '',
          ];

          for (const p of profiles) {
            const { result, schedule } = calculateLoanSchedule(p);

            // --- Thông số hồ sơ ---
            csvSections.push(`## HỔ SƠ: ${p.name}`);
            csvSections.push(toCSV(
              ['Thông số', 'Giá trị'],
              [
                { 'Thông số': 'Ngày giải ngân',             'Giá trị': p.startDate || '' },
                { 'Thông số': 'Ngày trả nợ đầu tiên',        'Giá trị': p.firstPaymentDate || '' },
                { 'Thông số': 'Số tiền vay (VND)',            'Giá trị': p.principal || 0 },
                { 'Thông số': 'Kỳ hạn (tháng)',               'Giá trị': p.termMonths || '' },
                { 'Thông số': 'Lãi ưu đãi (%/năm)',            'Giá trị': p.promoRate || '' },
                { 'Thông số': 'Thời gian ưu đãi (tháng)',       'Giá trị': p.promoMonths || '' },
                { 'Thông số': 'Lãi cơ sở (%)',                 'Giá trị': p.baseRate || '' },
                { 'Thông số': 'Biên độ (+%)',                   'Giá trị': p.marginRate || '' },
                { 'Thông số': 'Ngân sách/tháng (VND)',          'Giá trị': p.extraPayment || 0 },
                { 'Thông số': 'Ngưỡng tất toán (VND)',          'Giá trị': p.offsetThreshold || 0 },
                { 'Thông số': 'Kết quả - Khoản trả tháng đầu', 'Giá trị': result?.initialMonthlyPayment || '' },
                { 'Thông số': 'Kết quả - Tổng lãi (không trả sớm)', 'Giá trị': result?.baseTotalInterest || '' },
                { 'Thông số': 'Kết quả - Tổng lãi thực tế',   'Giá trị': result?.actualTotalInterest || '' },
                { 'Thông số': 'Kết quả - Phí phạt',            'Giá trị': result?.totalPenalty || 0 },
                { 'Thông số': 'Kết quả - Tiết kiệm lãi',       'Giá trị': result?.interestSaved || 0 },
                { 'Thông số': 'Kết quả - Tất toán tại tháng',  'Giá trị': result?.actualMonths || '' },
                { 'Thông số': 'Kết quả - Rút ngắn được',       'Giá trị': result?.monthsSaved ? `${result.monthsSaved} tháng` : '' },
                { 'Thông số': 'Kết quả - Dự kiến tất toán',   'Giá trị': result?.payoffDateStr || '' },
              ]
            ));

            // --- Bảng dòng tiền ---
            csvSections.push('');
            csvSections.push(`### Bảng chi tiết dòng tiền: ${p.name}`);
            if (schedule.length > 0) {
              csvSections.push(toCSV(
                ['Kỳ', 'Ngày trả', 'Lãi', 'Gốc', 'Tổng phải trả', 'Tất toán', 'Phạt', 'Ví tích luỹ', 'Dư nợ còn lại'],
                schedule.map(row => ({
                  'Kỳ': row.month,
                  'Ngày trả': row.date,
                  'Lãi': row.interest,
                  'Gốc': row.principal,
                  'Tổng phải trả': row.total,
                  'Tất toán': row.prepay || '',
                  'Phạt': row.penalty || '',
                  'Ví tích luỹ': row.accumulated,
                  'Dư nợ còn lại': row.remaining,
                }))
              ));
            }
            csvSections.push(''); // separator between profiles
          }

          downloadCSV(csvSections.join('\n'), `FT_HoSoVay_${dateStr}.csv`);
        }
      }

      // --- 5. Dự báo Tài chính ---
      if (exportSelections.projection) {
        // Lấy NW hiện tại
        const { data: accData } = await supabase.from('accounts').select('balance, sub_type');
        const nw = (accData || []).reduce((s, a) => a.sub_type === 'debt' ? s - a.balance : s + a.balance, 0);
        const rate = 0.08 / 12; // 8%/năm
        const monthly = 5000000; // Mặc định 5 triệu/tháng nếu không có dữ liệu
        const rows = [];
        let val = nw;
        for (let m = 0; m <= 120; m++) {
          if (m > 0) val = val * (1 + rate) + monthly;
          rows.push({ month: m, assets: Math.round(val) });
        }
        const csv = toCSV(['month', 'assets'], rows);
        downloadCSV(csv, `FT_DuBao120T_${dateStr}.csv`);
      }

    } catch (err) {
      alert('Lỗi khi xuất dữ liệu: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleWipeData = async () => {
    const confirmed1 = window.confirm(
      '⚠️ CẢNH BÁO: Hành động này sẽ XÓA VĨNH VIỄN toàn bộ dữ liệu của bạn (Giao dịch, Tài khoản, Mục tiêu...). Không thể khôi phục!\n\nBạn có chắc chắn muốn tiếp tục?'
    );
    if (!confirmed1) return;

    const confirmed2 = window.confirm(
      'LẦN XÁC NHẬN CUỐI: Gõ OK để đồng ý xóa trắng toàn bộ dữ liệu tài chính của bạn.'
    );
    if (!confirmed2) return;

    setWipeLoading(true);
    try {
      // Delete in correct order due to FK constraints
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('budgets').delete().eq('user_id', user.id);
      await supabase.from('goals').delete().eq('user_id', user.id);
      await supabase.from('savings').delete().eq('user_id', user.id);
      await supabase.from('investments').delete().eq('user_id', user.id);
      await supabase.from('accounts').delete().eq('user_id', user.id);
      await supabase.from('categories').delete().eq('user_id', user.id);

      alert('✅ Đã xóa toàn bộ dữ liệu thành công. Ứng dụng sẽ tải lại.');
      window.location.href = '/';
    } catch (err) {
      alert('Lỗi khi xóa dữ liệu: ' + err.message);
    } finally {
      setWipeLoading(false);
    }
  };

  const displayName = profile?.display_name || user?.user_metadata?.display_name || 'Người dùng';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="pb-24 animate-in fade-in">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pt-12 pb-8 rounded-b-[2.5rem] shadow-md">
        <h1 className="text-2xl font-black text-white text-center mb-5">Cài đặt & Hồ sơ</h1>
        <div className="bg-white/10 border border-white/20 p-4 rounded-2xl flex items-center space-x-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center shrink-0 text-white text-xl font-black">
            {initials}
          </div>
          <div className="text-white overflow-hidden flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{displayName}</p>
            <p className="text-sm text-blue-100 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-5">

        {/* Section: Công cụ & Phân tích */}
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 px-1">Công cụ & Phân tích</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            <button
              onClick={() => setShowLoanSheet(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                  💳
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Tính Lãi Khoản Vay</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Mô phỏng trả nợ trước hạn &amp; Tiết kiệm lãi</p>
                </div>
              </div>
              <ChevronRight className="text-gray-400 shrink-0" size={20} />
            </button>
            <button
              onClick={() => setShowCompoundSheet(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl">
                  📈
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Sức mạnh Lãi Kép</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Xem dòng tiền bùng nở theo thời gian</p>
                </div>
              </div>
              <ChevronRight className="text-gray-400 shrink-0" size={20} />
            </button>
          </div>
        </div>

        {/* Section: Tuỳ chỉnh ứng dụng */}
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 px-1">Tuỳ chỉnh Ứng dụng</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            <button
              onClick={() => setShowCategorySheet(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <FolderTree size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Quản lý Danh mục</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Thêm / Sửa / Xóa danh mục Thu - Chi</p>
                </div>
              </div>
              <ChevronRight className="text-gray-400 shrink-0" size={20} />
            </button>
          </div>
        </div>

        {/* Section: Dữ liệu */}
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 px-1">Quản lý Dữ liệu</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">

            {/* Export CSV - Expandable Panel */}
            <div>
              <button
                onClick={() => setShowExportPanel(v => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                    <Download size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Xuất báo cáo (CSV)</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Chọn từng loại báo cáo cần tải</p>
                  </div>
                </div>
                <ChevronRight className={`text-gray-400 shrink-0 transition-transform ${showExportPanel ? 'rotate-90' : ''}`} size={20} />
              </button>

              {showExportPanel && (
                <div className="px-4 pb-4 bg-sky-50/50 border-t border-sky-100 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-3">Chọn báo cáo cần xuất:</p>
                  {[
                    { key: 'transactions', label: 'Lịch sử Giao dịch', desc: 'Tất cả thu/chi/chuyển khoản', icon: '📋' },
                    { key: 'accounts',     label: 'Tài khoản & Số dư',  desc: 'Danh sách ví và số dư hiện tại', icon: '🏦' },
                    { key: 'goals',        label: 'Mục tiêu Tiết kiệm', desc: 'Tiến độ các mục tiêu', icon: '🎯' },
                    { key: 'loanProfiles', label: 'Hồ sơ Khoản Vay', desc: 'Các kịch bản đã lưu', icon: '💳' },
                    { key: 'projection',   label: 'Dự báo Tài chính', desc: 'Snapshot 120 tháng (8%/năm)', icon: '🔮' },
                  ].map(({ key, label, desc, icon }) => (
                    <label key={key} className="flex items-center space-x-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={exportSelections[key]}
                        onChange={e => setExportSelections(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-5 h-5 rounded accent-sky-500 shrink-0"
                      />
                      <span className="text-xl shrink-0">{icon}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </label>
                  ))}
                  <button
                    onClick={handleExportData}
                    disabled={exportLoading}
                    className="w-full mt-2 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-60 active:scale-95 transition-all"
                  >
                    {exportLoading
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Download size={18} />}
                    <span>{exportLoading ? 'Đang xuất...' : 'Tải xuống'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Wipe Data */}
            <button
              onClick={handleWipeData}
              disabled={wipeLoading}
              className="w-full flex items-center space-x-3 p-4 hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0">
                {wipeLoading
                  ? <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <Trash2 size={20} />}
              </div>
              <div className="text-left">
                <p className="font-bold text-red-600">Xóa toàn bộ dữ liệu</p>
                <p className="text-xs text-red-400 font-medium mt-0.5">Đặt lại tài khoản từ đầu (Không thể hoàn tác)</p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer: Đăng xuất */}
        <div className="pt-4">
          <button
            onClick={handleSignOut}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 active:scale-95 transition-transform"
          >
            <LogOut size={18} />
            <span>Đăng xuất Tài khoản</span>
          </button>
        </div>

        {/* App version info */}
        <div className="text-center pt-2 pb-4">
          <p className="text-xs text-gray-300 font-medium">FinanceTracker v1.0.0</p>
        </div>
      </div>

      {/* Bottom Sheets */}
      <CategoryManagementSheet
        isOpen={showCategorySheet}
        onClose={() => setShowCategorySheet(false)}
      />
      <LoanCalculatorSheet
        isOpen={showLoanSheet}
        onClose={() => setShowLoanSheet(false)}
      />
      <CompoundInterestSheet
        isOpen={showCompoundSheet}
        onClose={() => setShowCompoundSheet(false)}
      />
    </div>
  );
}
