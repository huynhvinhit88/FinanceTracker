import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../lib/db';
import { 
  exportDatabaseToJSON, 
  importDatabaseFromJSON,
  selectDirectoryHandle,
  verifyDirectoryPermission,
  writeBlobToFolder,
  getValidToken
} from '../lib/syncService';
import { RefreshCw, CloudDownload, CloudUpload, FolderTree, Trash2, ChevronRight, Download, ShieldCheck, Lock, FolderOpen } from 'lucide-react';
import { CategoryManagementSheet } from '../components/settings/CategoryManagementSheet';
import { ChangePinSheet } from '../components/settings/ChangePinSheet';
import { DriveFolderPicker } from '../components/settings/DriveFolderPicker';
import { DriveFilePicker } from '../components/settings/DriveFilePicker';
import { LoanCalculatorSheet } from '../components/tools/LoanCalculatorSheet';
import { CompoundInterestSheet } from '../components/tools/CompoundInterestSheet';
import { calculateLoanSchedule } from '../utils/loanCalculator';

export default function Settings() {
  const { user, signOut, lock } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showChangePinSheet, setShowChangePinSheet] = useState(false);
  const [showLoanSheet, setShowLoanSheet] = useState(false);
  const [showCompoundSheet, setShowCompoundSheet] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showBackupPanel, setShowBackupPanel] = useState(false);
  const [folderHandle, setFolderHandle] = useState(null);
  const [hasFolderPermission, setHasFolderPermission] = useState(false);
  const [selectedExportYear, setSelectedExportYear] = useState(new Date().getFullYear());
  const [exportSelections, setExportSelections] = useState({
    transactions: false,
    accounts: false,
    goals: false,
    loanProfiles: false,
    projection: false,
  });
  const [isMobileDevice, setIsMobileDevice] = useState(!window.showDirectoryPicker);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showDriveFilePicker, setShowDriveFilePicker] = useState(false);
  const [driveFolder, setDriveFolder] = useState(null);

  useEffect(() => {
    if (user) {
      loadDirectoryHandle();
      loadDriveFolder();
    }
    // Update mobile detection in case it changes (unlikely but good for testing)
    setIsMobileDevice(!window.showDirectoryPicker);
  }, [user]);

  const loadDriveFolder = async () => {
    const record = await db.settings.get('googleDriveFolder');
    if (record) {
      setDriveFolder(record.value);
    }
  };

  const loadDirectoryHandle = async () => {
    const record = await db.settings.get('localDirectoryHandle');
    if (record) {
      setFolderHandle(record.value);
      // Check permission but don't prompt immediately
      const granted = await verifyDirectoryPermission(record.value, false);
      setHasFolderPermission(granted);
    }
  };

  const handleSelectFolder = async () => {
    if (isMobileDevice) {
      try {
        await getValidToken(); // Ensure token is ready while it's still a user gesture
        setShowDrivePicker(true);
      } catch (err) {
        console.error('Drive connection error:', err);
        alert('Không thể kết nối Google Drive. Vui lòng thử lại.');
      }
      return;
    }

    try {
      const handle = await selectDirectoryHandle();
      setFolderHandle(handle);
      setHasFolderPermission(true);
      
      // Lưu cấu hình vào DB
      await db.settings.put({ key: 'localDirectoryHandle', value: handle });
      
      alert(`Đã chọn thư mục: ${handle.name}`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert(err.message);
      }
    }
  };

  const handleDriveFolderSelect = async (folder) => {
    setDriveFolder(folder);
    
    // Lưu cấu hình vào DB
    await db.settings.put({ key: 'googleDriveFolder', value: folder });
    
    alert(`Đã chọn thư mục Google Drive: ${folder.name}`);
  };

  const handleVerifyFolder = async () => {
    if (!folderHandle) return;
    const granted = await verifyDirectoryPermission(folderHandle, true);
    setHasFolderPermission(granted);
    if (granted) {
      alert('Đã khôi phục quyền truy cập thư mục.');
    }
  };

  const handleDriveFileSelect = async (file) => {
    if (!window.confirm(`Bạn có chắc muốn khôi phục dữ liệu từ bản sao lưu "${file.name}"? Dữ liệu hiện tại sẽ bị ghi đè.`)) {
      return;
    }
    
    setExportLoading(true);
    try {
      const { downloadFromDrive } = await import('../lib/syncService');
      await downloadFromDrive(file.id);
      
      alert('Khôi phục dữ liệu từ Google Drive thành công! Ứng dụng sẽ tải lại.');
      window.location.reload();
    } catch (err) {
      alert('Lỗi khôi phục: ' + err.message);
    } finally {
      setExportLoading(false);
      setShowDriveFilePicker(false);
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

  const downloadCSV = async (content, filename) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    
    if (folderHandle && hasFolderPermission) {
      try {
        await writeBlobToFolder(folderHandle, filename, blob);
        return true;
      } catch (err) {
        console.warn("Folder save failed, falling back to download", err);
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  };

  const downloadXLSX = async (workbook, filename) => {
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    if (folderHandle && hasFolderPermission) {
      try {
        await writeBlobToFolder(folderHandle, filename, blob);
        return true;
      } catch (err) {
        console.warn("Folder save failed, falling back to download", err);
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const results = [];
      
      if (exportSelections.transactions) {
        results.push(fetchAndExportTransactions(selectedExportYear));
      }
      if (exportSelections.accounts) {
        results.push(fetchAndExportAccounts());
      }
      if (exportSelections.goals) {
        results.push(fetchAndExportGoals());
      }
      if (exportSelections.loanProfiles) {
        results.push(fetchAndExportLoans());
      }
      if (exportSelections.projection) {
        results.push(generateAndExportProjection());
      }

      await Promise.all(results);
      alert(hasFolderPermission ? `Đã xuất toàn bộ báo cáo vào thư mục ${folderHandle.name}` : 'Đã tải xuống các tệp báo cáo.');
    } catch (err) {
      alert('Lỗi khi xuất dữ liệu: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleBackupToJSON = async () => {
    setExportLoading(true);
    try {
      // Ưu tiên 1: Google Drive (Nếu đã chọn thư mục Drive)
      if (driveFolder) {
        const { uploadToDrive } = await import('../lib/syncService');
        await uploadToDrive(driveFolder.id);
        alert(`Đã sao lưu thành công lên Google Drive: ${driveFolder.name}`);
        setExportLoading(false);
        return;
      }

      // Ưu tiên 2: Thư mục Local (Nếu đã chọn và có quyền)
      if (folderHandle) {
        const granted = await verifyDirectoryPermission(folderHandle, true);
        setHasFolderPermission(granted);
        
        if (granted) {
          await exportDatabaseToJSON(folderHandle);
          alert(`Đã sao lưu tự động vào thư mục: ${folderHandle.name}`);
          setExportLoading(false);
          return;
        }
      }

      // Cuối cùng: Tải xuống thủ công
      await exportDatabaseToJSON(null);
      alert('Đã tải xuống bản sao lưu JSON.');
    } catch (err) {
      alert('Lỗi khi sao lưu dữ liệu: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const fetchAndExportTransactions = async (year) => {
    const isAll = year === 'all';
    const start = isAll ? '1970-01-01T00:00:00.000Z' : `${year}-01-01T00:00:00.000Z`;
    const end = isAll ? '2099-12-31T23:59:59.999Z' : `${year}-12-31T23:59:59.999Z`;
    
    const txs = await db.transactions
      .filter(t => t.date >= start && t.date <= end)
      .toArray();
    
    const cats = await db.categories.toArray();
    const accs = await db.accounts.toArray();
    
    const rows = txs.map(t => ({
      'Ngày': new Date(t.date).toLocaleDateString('vi-VN'),
      'Loại': t.type === 'income' ? 'Thu' : (t.type === 'expense' ? 'Chi' : 'Chuyển'),
      'Hạng mục': cats.find(c => c.id === t.category_id)?.name || 'Khác',
      'Tài khoản': accs.find(a => a.id === t.account_id)?.name || 'N/A',
      'Số tiền': t.amount,
      'Ghi chú': t.note || '',
      'Tags': (t.tags || []).join(', ')
    }));
    
    return downloadCSV(toCSV(['Ngày', 'Loại', 'Hạng mục', 'Tài khoản', 'Số tiền', 'Ghi chú', 'Tags'], rows), isAll ? 'Giao_dich_Tat_ca.csv' : `Giao_dich_${year}.csv`);
  };

  const fetchAndExportAccounts = async () => {
    const accs = await db.accounts.toArray();
    const rows = accs.map(a => ({
      'Tên tài khoản': a.name,
      'Loại': a.type,
      'Phân loại': a.sub_type,
      'Số dư': a.balance,
      'Tiền tệ': a.currency,
      'Trạng thái': a.status === 'active' ? 'Đang dùng' : 'Ẩn'
    }));
    return downloadCSV(toCSV(['Tên tài khoản', 'Loại', 'Phân loại', 'Số dư', 'Tiền tệ', 'Trạng thái'], rows), 'Danh_sach_tai_khoan.csv');
  };

  const fetchAndExportGoals = async () => {
    const goals = await db.goals.toArray();
    const rows = goals.map(g => ({
      'Mục tiêu': g.name,
      'Mục tiêu (đ)': g.target_amount,
      'Hiện có (đ)': g.current_amount,
      'Hạn chót': g.deadline ? new Date(g.deadline).toLocaleDateString('vi-VN') : '',
      'Trạng thái': g.status
    }));
    return downloadCSV(toCSV(['Mục tiêu', 'Mục tiêu (đ)', 'Hiện có (đ)', 'Hạn chót', 'Trạng thái'], rows), 'Muc_tieu_tiet_kiem.csv');
  };

  const fetchAndExportLoans = async () => {
    const storageKey = `loan_profiles_${user?.id || 'guest'}`;
    const profiles = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (profiles.length === 0) {
      alert('Không có hồ sơ khoản vay nào để xuất.');
      return;
    }

    const wb = XLSX.utils.book_new();

    profiles.forEach(p => {
      const { schedule, result } = calculateLoanSchedule(p);
      if (!schedule || !result) return;

      const summary = [
        ['THÔNG TIN HỒ SƠ', p.name],
        ['Số tiền vay', Number(p.principal)],
        ['Kỳ hạn (tháng)', Number(p.termMonths)],
        ['Lãi suất ưu đãi (%)', p.promoRate],
        ['Thời gian ưu đãi (tháng)', p.promoMonths],
        ['Lãi suất cơ sở (%)', p.baseRate],
        ['Biên độ (%)', p.marginRate],
        ['Chuỗi phí phạt', p.penaltyConfig],
        ['', ''],
        ['KẾT QUẢ MÔ PHỎNG', ''],
        ['Tháng đầu tiên phải trả', result.initialMonthlyPayment],
        ['Tổng lãi (Gốc)', result.baseTotalInterest],
        ['Thực trả (Lãi + Phí)', result.actualTotalInterest + result.totalPenalty],
        ['Tiết kiệm được', result.interestSaved],
        ['Rút ngắn được (tháng)', result.monthsSaved],
        ['Ngày tất toán dự kiến', result.payoffDateStr],
        ['', ''],
        ['LỊCH THANH TOÁN CHI TIẾT', '']
      ];

      const data = schedule.map(row => ({
        'Kỳ': row.month,
        'Ngày': row.date,
        'Dư nợ đầu kỳ': row.remaining,
        'Gốc': row.principal,
        'Lãi': row.interest,
        'Trả thêm/Tất toán': row.prepay,
        'Phí phạt': row.penalty,
        'Tổng trả': row.total,
        'Ví tích lũy': row.accumulated
      }));

      const ws = XLSX.utils.aoa_to_sheet(summary);
      XLSX.utils.sheet_add_json(ws, data, { origin: 'A19' });

      // Sanitize sheet name
      const safeName = p.name.replace(/[\\/?*[\]:]/g, '_').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeName || `Profile ${p.id}`);
    });

    return downloadXLSX(wb, 'Ho_so_khoan_vay.xlsx');
  };

  const generateAndExportProjection = async () => {
    // Logic from Plan.jsx
    const settingsMonth = await db.settings.get('targetProjectionMonth');
    const targetMonth = settingsMonth?.value || `${new Date().getFullYear() + 1}-12`;
    
    const planKey = `savings_plan_${user.id}`;
    const savingsPlan = JSON.parse(localStorage.getItem(planKey) || '{}');
    
    // Initial Data
    const allAccs = await db.accounts.toArray();
    const allSav = await db.savings.filter(s => s.status === 'active').toArray();
    const allInv = await db.investments.toArray();
    const allBudgets = await db.budgets.toArray();
    
    const accNW = allAccs.reduce((s, a) => s + (a.sub_type === 'debt' ? -a.balance : a.balance), 0);
    const savNW = allSav.reduce((s, x) => s + x.principal_amount, 0);
    const invNW = allInv.reduce((s, i) => s + (i.type === 'real_estate' ? (i.current_price - i.loan_amount) : (i.current_price * i.quantity)), 0);
    let currentNWVal = accNW + savNW + invNW;

    // Monthly Surplus Helper
    const getSurplus = (mKey) => {
      const inc = allBudgets.filter(b => b.type === 'income' && (b.month === mKey || !b.month)).reduce((s, b) => s + b.amount, 0);
      const exp = allBudgets.filter(b => b.type === 'expense' && (b.month === mKey || !b.month)).reduce((s, b) => s + b.amount, 0);
      return Math.max(0, inc - exp);
    };

    const [tY, tM] = targetMonth.split('-').map(Number);
    const now = new Date();
    const monthsDiff = (tY - now.getFullYear()) * 12 + (tM - (now.getMonth() + 1));
    
    const rows = [];
    const monthlyRate = 0.08 / 12; // Static 8% as per UI

    for (let i = 0; i <= Math.max(1, monthsDiff); i++) {
       const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
       const mKey = d.toISOString().slice(0, 7);
       const override = savingsPlan[mKey];
       const surplus = override !== undefined ? override : getSurplus(mKey);
       
       if (i > 0) {
         currentNWVal = currentNWVal * (1 + monthlyRate) + surplus;
       }
       
       rows.push({
         'Tháng': `${d.getMonth() + 1}/${d.getFullYear()}`,
         'Dự thu': allBudgets.filter(b => b.type === 'income' && (b.month === mKey || !b.month)).reduce((s, b) => s + b.amount, 0),
         'Dự chi': allBudgets.filter(b => b.type === 'expense' && (b.month === mKey || !b.month)).reduce((s, b) => s + b.amount, 0),
         'Tiết kiệm': surplus,
         'Tài sản ròng dự tính': Math.round(currentNWVal)
       });
    }

    return downloadCSV(toCSV(['Tháng', 'Dự thu', 'Dự chi', 'Tiết kiệm', 'Tài sản ròng dự tính'], rows), 'Du_bao_tai_chinh.csv');
  };

  const handleImportJson = async (e) => {
    let file;
    if (e.target && e.target.files) {
      file = e.target.files[0];
    } else {
      file = e; // file handle or direct file
    }

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

  const handleImportFromFolder = async () => {
    if (!folderHandle || !hasFolderPermission) return;
    try {
      if (window.showOpenFilePicker) {
        const [fileHandle] = await window.showOpenFilePicker({
          startIn: folderHandle,
          types: [{
            description: 'JSON Backup Files',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const file = await fileHandle.getFile();
        handleImportJson(file);
      } else {
        alert('Trình duyệt không hỗ trợ chọn file từ thư mục. Vui lòng chọn thủ công.');
      }
    } catch (err) {
       if (err.name !== 'AbortError') console.error(err);
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

  return (
    <div className="pb-24 p-4 safe-top animate-in fade-in transition-colors duration-300 dark:bg-slate-950">
      {/* Header */}
      <div className="flex justify-between items-center mb-10 mt-4 px-1">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">Cài đặt</h1>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Cấu hình & Quản lý dữ liệu</p>
        </div>
      </div>

      <div className="space-y-10">

        <div>
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Công cụ & Phân tích</p>
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
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Tuỳ chỉnh Ứng dụng</p>
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
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Quản lý Dữ liệu</p>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden divide-y divide-gray-50 dark:divide-white/5">
            <div>
              <button
                onClick={folderHandle ? handleVerifyFolder : handleSelectFolder}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/20 active:bg-gray-100 dark:active:bg-slate-800/40 transition-colors group text-left"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm border border-indigo-100/50 dark:border-indigo-900/50">
                    <FolderOpen size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 dark:text-slate-100 group-active:text-indigo-600 transition-colors">
                      {isMobileDevice 
                        ? (driveFolder ? 'Drive: ' + driveFolder.name : 'Chọn thư mục Google Drive')
                        : (folderHandle ? 'Thư mục: ' + folderHandle.name : 'Chọn thư mục lưu trữ')}
                    </p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${
                        isMobileDevice 
                          ? (driveFolder ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300')
                          : (folderHandle ? (hasFolderPermission ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500') : 'bg-gray-300')
                      }`} />
                      <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium leading-relaxed italic opacity-70">
                        {isMobileDevice
                          ? (driveFolder ? 'Sẵn sàng sao lưu lên đám mây' : 'Chọn một thư mục Drive để lưu trữ')
                          : (folderHandle 
                            ? (hasFolderPermission ? 'Đang hoạt động - Tự động lưu file' : 'Nhấp để cấp lại quyền truy cập')
                            : 'Sử dụng File System API để tự động hóa')}
                      </p>
                    </div>
                  </div>
                </div>
                {(folderHandle || (isMobileDevice && driveFolder)) && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSelectFolder(); }}
                    className="text-[10px] font-black text-indigo-600 hover:underline uppercase px-2"
                  >
                    Thay đổi
                  </button>
                )}
                <ChevronRight className="text-gray-300 group-hover:text-gray-400 shrink-0 ml-4" size={18} />
              </button>
            </div>

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
                  <div className="flex items-center justify-between pt-4 mb-2 px-5">
                    <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">Năm báo cáo:</p>
                    <select 
                      value={selectedExportYear}
                      onChange={e => setSelectedExportYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                      className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-1.5 text-xs font-black text-sky-600 outline-none"
                    >
                      <option value="all">Tất cả các năm</option>
                      {[0, 1, 2, 3].map(offset => {
                        const y = new Date().getFullYear() - offset;
                        return <option key={y} value={y}>{y}</option>;
                      })}
                    </select>
                  </div>
                  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 pl-5">Cấu hình báo cáo:</p>
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
                    <span>XÁC NHẬN TẢI BÁO CÁO</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <button
                onClick={() => setShowBackupPanel(v => !v)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/20 active:bg-gray-100 dark:active:bg-slate-800/40 transition-colors group text-left"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100/50 dark:border-emerald-900/50">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 dark:text-slate-100 group-active:text-emerald-600 transition-colors">Sao lưu & Khôi phục</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium mt-0.5 leading-relaxed italic opacity-70 line-clamp-1">Tải về hoặc nhập liệu file dự phòng JSON</p>
                  </div>
                </div>
                <ChevronRight className={`text-gray-300 group-hover:text-gray-400 shrink-0 transition-transform ml-4 ${showBackupPanel ? 'rotate-90' : ''}`} size={18} />
              </button>

              {showBackupPanel && (
                <div className="px-5 pb-5 bg-emerald-50/30 dark:bg-emerald-900/10 border-t border-emerald-100/50 dark:border-white/5 space-y-3">
                  <div className="pt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={handleBackupToJSON}
                      disabled={exportLoading}
                      className="flex flex-col items-center justify-center p-4 rounded-3xl bg-emerald-600 dark:bg-emerald-700 text-white space-y-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-emerald-100 dark:shadow-none"
                    >
                      {exportLoading
                        ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <CloudUpload size={18} />}
                      <span className="text-[11px] font-black uppercase tracking-wider">Sao lưu</span>
                    </button>
                    
                    <label 
                      onClick={() => {
                        if (isMobileDevice && driveFolder) {
                          setShowDriveFilePicker(true);
                        } else if (hasFolderPermission) {
                          handleImportFromFolder();
                        }
                      }}
                      className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white dark:bg-slate-800 border-2 border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 space-y-2 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <CloudDownload size={18} />
                      <span className="text-[11px] font-black uppercase tracking-wider">Khôi phục</span>
                      {(!isMobileDevice || !driveFolder) && !hasFolderPermission && <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />}
                    </label>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium text-center leading-relaxed px-4">
                    Tệp JSON chứa toàn bộ dữ liệu ứng dụng bao gồm tài khoản, giao dịch và cài đặt.
                  </p>
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
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Giao diện</p>
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
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Bảo mật & Quyền riêng tư</p>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden divide-y divide-gray-50 dark:divide-white/5 transition-colors">
            <button
              onClick={() => lock()}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/20 active:bg-gray-100 dark:active:bg-slate-800/40 transition-colors group text-left"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm border border-amber-100/50 dark:border-amber-900/50">
                  <Lock size={20} />
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-slate-100 group-active:text-amber-600 transition-colors">Khoá ứng dụng</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium mt-0.5 leading-relaxed italic opacity-70 line-clamp-1">Yêu cầu mã PIN ngay lập tức</p>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-gray-400 shrink-0 ml-4" size={18} />
            </button>

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
      <DriveFolderPicker
        isOpen={showDrivePicker}
        onClose={() => setShowDrivePicker(false)}
        onSelect={handleDriveFolderSelect}
      />
      <DriveFilePicker
        isOpen={showDriveFilePicker}
        onClose={() => setShowDriveFilePicker(false)}
        folderId={driveFolder?.id}
        folderName={driveFolder?.name}
        onSelect={handleDriveFileSelect}
      />
    </div>
  );
}
