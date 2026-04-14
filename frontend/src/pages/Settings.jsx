import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../lib/db';
import { 
  exportDatabaseToJSON, 
  importDatabaseFromJSON,
  initGoogleDriveSync,
  uploadToDrive,
  downloadFromDrive,
  checkRemoteBackup,
  getGoogleUserInfo,
  disconnectGoogleDrive
} from '../lib/syncService';
import { Cloud, RefreshCw, CloudDownload, CloudUpload, FolderTree, LogOut, Trash2, ChevronRight, Download, ShieldCheck } from 'lucide-react';
import { CategoryManagementSheet } from '../components/settings/CategoryManagementSheet';
import { ChangePinSheet } from '../components/settings/ChangePinSheet';
import { LoanCalculatorSheet } from '../components/tools/LoanCalculatorSheet';
import { CompoundInterestSheet } from '../components/tools/CompoundInterestSheet';
import { calculateLoanSchedule } from '../utils/loanCalculator';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showChangePinSheet, setShowChangePinSheet] = useState(false);
  const [showLoanSheet, setShowLoanSheet] = useState(false);
  const [showCompoundSheet, setShowCompoundSheet] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [exportSelections, setExportSelections] = useState({
    transactions: true,
    accounts: true,
    goals: true,
    loanProfiles: false,
    projection: false,
  });

  useEffect(() => {
    if (user) {
      fetchLastSync();
      initGoogleDriveSync();
    }
  }, [user]);

  const fetchLastSync = async () => {
    const record = await db.settings.get('lastDriveSync');
    if (record) setLastSync(record.value);
  };

  const fetchGoogleUser = async () => {
    const info = await getGoogleUserInfo();
    if (info) setGoogleUser(info);
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
    setExportLoading(true);
    try {
      if (exportSelections.transactions) {
        // Fallback or handle CSV logic here using Dexie if needed.
        // Or simply export entire JSON backup:
        await exportDatabaseToJSON();
        alert('Đã xuất file dự phòng định dạng JSON.');
      }
    } catch (err) {
      alert('Lỗi khi xuất dữ liệu: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportJson = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (window.confirm('Cảnh báo: Nhập file sao lưu sẽ ĐÈ lên toàn bộ dữ liệu hiện tại. Tiếp tục?')) {
      try {
         await importDatabaseFromJSON(file);
         alert('Khôi phục dữ liệu thành công! Ứng dụng sẽ tải lại.');
         window.location.reload();
      } catch (err) {
         alert('Lỗi khôi phục: ' + err.message);
      }
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
      // Delete all Dexie Tables
      await db.transactions.clear();
      await db.budgets.clear();
      await db.goals.clear();
      await db.savings.clear();
      await db.investments.clear();
      await db.accounts.clear();
      await db.categories.clear();

      alert('✅ Đã xóa toàn bộ dữ liệu thành công. Ứng dụng sẽ tải lại.');
      window.location.href = '/';
    } catch (err) {
      alert('Lỗi khi xóa dữ liệu: ' + err.message);
    } finally {
      setWipeLoading(false);
    }
  };

  const handleCloudBackup = async () => {
    setSyncLoading(true);
    try {
      await uploadToDrive();
      await fetchLastSync();
      await fetchGoogleUser();
      alert('✅ Đã sao lưu dữ liệu lên Google Drive thành công!');
    } catch (err) {
      alert('❌ Lỗi sao lưu: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCloudRestore = async () => {
    if (!window.confirm('⚠️ CẢNH BÁO: Khôi phục từ Cloud sẽ XÓA TOÀN BỘ dữ liệu hiện tại trên máy này và thay thế bằng bản trên Drive. Bạn có chắc chắn?')) return;
    
    setSyncLoading(true);
    try {
      await downloadFromDrive();
      await fetchGoogleUser();
      alert('✅ Khôi phục thành công! Ứng dụng sẽ tải lại.');
      window.location.reload();
    } catch (err) {
      alert('❌ Lỗi khôi phục: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSwitchGoogleAccount = () => {
    if (window.confirm('Bạn muốn đổi tài khoản Google Drive khác?')) {
      disconnectGoogleDrive();
      setGoogleUser(null);
      alert('Đã ngắt kết nối tài khoản cũ. Vui lòng chọn tài khoản mới trong lần sao lưu tới.');
    }
  };

  return (
    <div className="pb-24 animate-in fade-in">
      {/* Header - Left Aligned to Icon Axis */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 pt-16 pb-8 rounded-b-[2.5rem] shadow-lg">
        <h1 className="text-3xl font-extrabold text-white text-left tracking-tighter pl-11">Cài đặt</h1>
      </div>

      <div className="px-6 mt-10 space-y-9">

        <div>
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 pl-11">Công cụ & Phân tích</p>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden divide-y divide-gray-50 dark:divide-white/5">
            <button
              onClick={() => setShowLoanSheet(true)}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/20 active:bg-gray-100 dark:active:bg-slate-800/40 transition-colors group text-left"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shrink-0 shadow-sm border border-blue-100/50 dark:border-blue-900/30">
                  💳
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-slate-100 group-active:text-blue-600 transition-colors">Tính Lãi Khoản Vay</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium mt-0.5 leading-relaxed italic opacity-70 line-clamp-1">Mô phỏng trả nợ & tiết kiệm lãi</p>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-gray-400 shrink-0 ml-4" size={18} />
            </button>
            <button
              onClick={() => setShowCompoundSheet(true)}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/20 active:bg-gray-100 dark:active:bg-slate-800/40 transition-colors group text-left"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xl shrink-0 shadow-sm border border-orange-100/50 dark:border-orange-900/30">
                  📈
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-slate-100 group-active:text-orange-600 transition-colors">Sức mạnh Lãi Kép</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium mt-0.5 leading-relaxed italic opacity-70 line-clamp-1">Xem dòng tiền bùng nở theo thời gian</p>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-gray-400 shrink-0 ml-4" size={18} />
            </button>
          </div>
        </div>


        <div>
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 pl-11">Tuỳ chỉnh Ứng dụng</p>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
            <button
              onClick={() => setShowCategorySheet(true)}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/20 active:bg-gray-100 dark:active:bg-slate-800/40 transition-colors group text-left"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100/50 dark:border-emerald-900/50">
                  <FolderTree size={20} />
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-slate-100 group-active:text-emerald-600 transition-colors">Quản lý Danh mục</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium mt-0.5 leading-relaxed italic opacity-70 line-clamp-1">Thêm / Sửa / Xóa danh mục Thu - Chi</p>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-gray-400 shrink-0 ml-4" size={18} />
            </button>
          </div>
        </div>

        {/* Section: Dữ liệu */}
        <div>
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 pl-11">Quản lý Dữ liệu</p>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden divide-y divide-gray-50 dark:divide-white/5">
            <div>
              <button
                onClick={() => setShowExportPanel(v => !v)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/20 active:bg-gray-100 dark:active:bg-slate-800/40 transition-colors group text-left"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-sm border border-sky-100/50 dark:border-sky-900/50">
                    <Download size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 dark:text-slate-100 group-active:text-sky-600 transition-colors">Xuất báo cáo (CSV)</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium mt-0.5 leading-relaxed italic opacity-70 line-clamp-1">Chọn từng loại báo cáo cần tải</p>
                  </div>
                </div>
                <ChevronRight className={`text-gray-300 group-hover:text-gray-400 shrink-0 transition-transform ml-4 ${showExportPanel ? 'rotate-90' : ''}`} size={18} />
              </button>

              {showExportPanel && (
                <div className="px-5 pb-5 bg-sky-50/30 dark:bg-sky-900/10 border-t border-sky-100/50 dark:border-white/5 space-y-3">
                  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] pt-4 mb-2 pl-5">Cấu hình báo cáo:</p>
                  {[
                    { key: 'transactions', label: 'Lịch sử Giao dịch', desc: 'Tất cả thu/chi/chuyển khoản', icon: '📋' },
                    { key: 'accounts',     label: 'Tài khoản & Số dư',  desc: 'Danh sách ví và số dư hiện tại', icon: '🏦' },
                    { key: 'goals',        label: 'Mục tiêu Tiết kiệm', desc: 'Tiến độ các mục tiêu', icon: '🎯' },
                    { key: 'loanProfiles', label: 'Hồ sơ Khoản Vay', desc: 'Các kịch bản đã lưu', icon: '💳' },
                    { key: 'projection',   label: 'Dự báo Tài chính', desc: 'Snapshot 120 tháng (8%/năm)', icon: '🔮' },
                  ].map(({ key, label, desc, icon }) => (
                    <label key={key} className="flex items-start space-x-4 cursor-pointer p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all group">
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={exportSelections[key]}
                          onChange={e => setExportSelections(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="w-5 h-5 rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sky-500 focus:ring-sky-500 accent-sky-500 shrink-0"
                        />
                      </div>
                      <span className="text-xl shrink-0 pt-0.5">{icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-black text-gray-800 dark:text-slate-100 group-hover:text-sky-600 transition-colors tracking-tight">{label}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </label>
                  ))}
                  <button
                    onClick={handleExportData}
                    disabled={exportLoading}
                    className="w-full mt-2 bg-sky-600 dark:bg-sky-700 hover:bg-sky-700 dark:hover:bg-sky-600 text-white font-black py-4 rounded-2xl flex items-center justify-center space-x-2 disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-sky-100 dark:shadow-none"
                  >
                    {exportLoading
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Download size={18} />}
                    <span>{exportLoading ? 'ĐANG TẠO FILE...' : 'TẢI MÃ NGUỒN DỰ PHÒNG JSON'}</span>
                  </button>
                  <label className="w-full mt-2 bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-black py-4 rounded-2xl flex items-center justify-center space-x-2 disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-emerald-100 dark:shadow-none cursor-pointer">
                    <Download size={18} className="rotate-180" />
                    <span>NHẬP FILE DỰ PHÒNG CHUẨN JSON</span>
                    <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            <button
              onClick={handleWipeData}
              disabled={wipeLoading}
              className="w-full flex items-center space-x-4 p-5 hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 dark:active:bg-red-950/40 transition-colors disabled:opacity-60 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 flex items-center justify-center shrink-0 shadow-sm border border-red-100/50 dark:border-red-900/50">
                {wipeLoading ? <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={20} />}
              </div>
              <div className="text-left">
                <p className="font-black text-red-600 dark:text-red-400">Xóa toàn bộ dữ liệu</p>
                <p className="text-[11px] text-red-400 dark:text-red-500 font-medium mt-0.5 leading-relaxed italic opacity-70 line-clamp-1">Đặt lại tài khoản từ đầu</p>
              </div>
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 pl-11">Giao diện</p>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
            <div className="w-full flex items-center justify-between p-5 transition-colors group text-left">
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 flex items-center justify-center text-xl shrink-0 shadow-sm border border-slate-200 dark:border-slate-700">
                  {theme === 'dark' ? '🌙' : '☀️'}
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-slate-100">Giao diện tối</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium mt-0.5 leading-relaxed italic opacity-70">Tiết kiệm pin & dịu mắt</p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className={`w-14 h-8 rounded-full transition-all duration-300 flex items-center px-1 relative ${theme === 'dark' ? 'bg-indigo-600 shadow-inner' : 'bg-gray-200'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 pl-11">Lưu trữ Đám mây</p>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden p-6 transition-colors">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100/50 dark:border-indigo-900/50 shadow-sm">
                <Cloud size={24} />
              </div>
              <div>
                <p className="font-black text-gray-900 dark:text-slate-100 leading-tight">Google Drive Sync</p>
                <div className="flex flex-col mt-1">
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium italic">
                    {lastSync 
                      ? `Đồng bộ lần cuối: ${new Date(lastSync).toLocaleString('vi-VN')}` 
                      : 'Chưa bao giờ đồng bộ'}
                  </p>
                  {googleUser ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                        {googleUser.email}
                      </p>
                      <button 
                        onClick={handleSwitchGoogleAccount}
                        className="text-[9px] font-black text-gray-400 dark:text-slate-500 hover:text-red-500 uppercase tracking-tighter underline"
                      >
                        Đổi tài khoản
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-tighter italic">
                      Tài khoản: Chưa liên kết
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCloudBackup}
                disabled={syncLoading}
                className="flex flex-col items-center justify-center p-4 rounded-3xl bg-indigo-600 dark:bg-indigo-700 text-white space-y-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                {syncLoading ? <RefreshCw className="animate-spin" size={20} /> : <CloudUpload size={20} />}
                <span className="text-[11px] font-black uppercase tracking-wider">Sao lưu</span>
              </button>
              
              <button
                onClick={handleCloudRestore}
                disabled={syncLoading}
                className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 space-y-2 active:scale-95 transition-all disabled:opacity-50"
              >
                <CloudDownload size={20} />
                <span className="text-[11px] font-black uppercase tracking-wider">Khôi phục</span>
              </button>
            </div>

            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium mt-4 text-center leading-relaxed">
              Dữ liệu được lưu an toàn trong thư mục ẩn của ứng dụng trên Google Drive của bạn.
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 pl-11">Bảo mật & Quyền riêng tư</p>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden divide-y divide-gray-50 dark:divide-white/5 transition-colors">
            <button
              onClick={() => setShowChangePinSheet(true)}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/20 active:bg-gray-100 dark:active:bg-slate-800/40 transition-colors group text-left"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-sm border border-blue-100/50 dark:border-blue-900/50">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-slate-100 group-active:text-blue-600 transition-colors">Đổi mã PIN</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium mt-0.5 leading-relaxed italic opacity-70 line-clamp-1">Thay đổi mật khẩu mở khóa ứng dụng</p>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-gray-400 shrink-0 ml-4" size={18} />
            </button>
          </div>
        </div>

        {/* Footer: Đăng xuất */}
        <div className="pt-6 px-6">
          <button
            onClick={handleSignOut}
            className="w-full bg-gray-100 dark:bg-slate-900 hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-100 font-bold py-5 rounded-[2rem] flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-sm border border-transparent dark:border-white/5"
          >
            <LogOut size={18} />
            <span className="tracking-tight">Đăng xuất Tài khoản</span>
          </button>
        </div>

        {/* App version info */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest">FinanceTracker v1.1.1</p>
        </div>
      </div>

      {/* Bottom Sheets */}
      <CategoryManagementSheet
        isOpen={showCategorySheet}
        onClose={() => setShowCategorySheet(false)}
      />
      <ChangePinSheet
        isOpen={showChangePinSheet}
        onClose={() => setShowChangePinSheet(false)}
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
