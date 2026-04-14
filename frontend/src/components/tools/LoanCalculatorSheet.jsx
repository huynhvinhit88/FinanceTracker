import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { formatCurrency, parseCurrencyInput } from '../../utils/format';
import { Calculator, ChevronRight, Settings2, Save, FilePlus2, Trash2, PlusCircle, XCircle, Landmark } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AddLoanSheet } from '../loans/AddLoanSheet';
import { calculateLoanSchedule } from '../../utils/loanCalculator';

export function LoanCalculatorSheet({ isOpen, onClose }) {
  const { user } = useAuth();
  const storageKey = `loan_profiles_${user?.id || 'guest'}`;

  // Helper: hiển thị số thập phân dùng dấu phẩy (kiểu VN)
  const toViDecimal = (val) => {
    if (val === '' || val === null || val === undefined) return '';
    return String(val).replace('.', ',');
  };

  // Helper: chỉ cho phép nhập số và dấu phẩy
  const handleRateChange = (setter) => (e) => {
    const raw = e.target.value;
    if (!/^[\d,]*$/.test(raw)) return;
    setter(raw);
  };

  // Profiles State
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState('');

  // 1. Cấu hình Vay
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [firstPaymentDate, setFirstPaymentDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const { displayValue: displayPrincipal, value: principal, handleInputChange: handlePrincipalChange, setExternalValue: setExternalPrincipal, reset: resetPrincipal, suffix } = useCurrencyInput('');
  const [termMonths, setTermMonths] = useState('');

  // 2. Cấu hình Lãi suất
  const [promoRate, setPromoRate] = useState('');
  const [promoMonths, setPromoMonths] = useState('');
  const [baseRate, setBaseRate] = useState('');
  const [marginRate, setMarginRate] = useState('');

  // 3. Cơ chế Tất toán & Tiết kiệm
  const { displayValue: displayExtra, value: extraPayment, handleInputChange: handleExtraChange, setExternalValue: setExternalExtra, reset: resetExtra, suffix: extraSuffix } = useCurrencyInput('');
  const { displayValue: displayThreshold, value: offsetThreshold, handleInputChange: handleThresholdChange, setExternalValue: setExternalThreshold, reset: resetThreshold, suffix: thresholdSuffix } = useCurrencyInput('');
  const [penaltyConfig, setPenaltyConfig] = useState('3, 3, 3, 1, 0');

  // 4. Kế hoạch theo Giai đoạn (Periods)
  const [periods, setPeriods] = useState([]);
  const [showPeriods, setShowPeriods] = useState(false);

  // UI States
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [isAddRealLoanOpen, setIsAddRealLoanOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setProfiles(JSON.parse(stored));
      }
    }
  }, [isOpen, storageKey]);

  const loadProfile = (id) => {
    setActiveProfileId(id);
    if (!id) {
      setStartDate(new Date().toISOString().slice(0, 10));
      const d = new Date(); d.setMonth(d.getMonth() + 1);
      setFirstPaymentDate(d.toISOString().slice(0, 10));
      resetPrincipal();
      setTermMonths('');
      setPromoRate('');
      setPromoMonths('');
      setBaseRate('');
      setMarginRate('');
      resetExtra();
      resetThreshold();
      setPenaltyConfig('3, 3, 3, 1, 0');
      setPeriods([]);
      setResult(null);
      setShowAdvanced(false);
      return;
    }
    const p = profiles.find(x => x.id === id);
    if (p) {
      setStartDate(p.startDate || new Date().toISOString().slice(0, 10));
      setFirstPaymentDate(p.firstPaymentDate || (() => { const d = new Date(p.startDate || Date.now()); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })());
      setExternalPrincipal(p.principal || 0);
      setTermMonths(p.termMonths || '');
      setPromoRate(p.promoRate || '');
      setPromoMonths(p.promoMonths || '');
      setBaseRate(p.baseRate || '');
      setMarginRate(p.marginRate || '');
      setExternalExtra(p.extraPayment || 0);
      setExternalThreshold(p.offsetThreshold || 0);
      setPenaltyConfig(p.penaltyConfig || '3, 3, 3, 1, 0');
      setPeriods(p.periods || []);

      if (p.baseRate || p.extraPayment || p.marginRate) setShowAdvanced(true);
      if (p.periods?.length > 0) { setShowAdvanced(true); setShowPeriods(true); }
      setResult(null); 
    }
  };

  const handleSaveProfile = (asNew = false) => {
    let targetName = '';
    const currentProfile = profiles.find(x => x.id === activeProfileId);

    if (asNew || !activeProfileId) {
      targetName = window.prompt('Nhập tên để lưu hồ sơ mô phỏng (VD: Vay mua nhà VCB):', '');
      if (!targetName) return;
    } else {
      targetName = currentProfile.name;
    }

    const payload = {
      startDate, firstPaymentDate, principal, termMonths, promoRate, promoMonths,
      baseRate, marginRate, extraPayment, offsetThreshold, penaltyConfig, periods
    };

    let newProfiles = [...profiles];
    if (asNew || !activeProfileId) {
      const newP = { id: Date.now().toString(), name: targetName, ...payload };
      newProfiles.push(newP);
      setActiveProfileId(newP.id);
    } else {
      newProfiles = newProfiles.map(p => p.id === activeProfileId ? { ...p, ...payload, name: targetName } : p);
    }

    setProfiles(newProfiles);
    localStorage.setItem(storageKey, JSON.stringify(newProfiles));
    alert('Đã lưu hồ sơ thành công!');
  };

  const handleDeleteProfile = () => {
    if (!activeProfileId) return;
    if (window.confirm('Bạn có chắc muốn xoá hồ sơ này?')) {
      const newProfiles = profiles.filter(p => p.id !== activeProfileId);
      setProfiles(newProfiles);
      localStorage.setItem(storageKey, JSON.stringify(newProfiles));
      loadProfile(''); 
    }
  };

  const calculateLoan = (e) => {
    e.preventDefault();
    if (!principal || !termMonths) return;

    const { result: summary, schedule: list } = calculateLoanSchedule({
      principal: principal,
      termMonths: termMonths,
      promoRate,
      promoMonths,
      baseRate,
      marginRate,
      extraPayment,
      offsetThreshold,
      penaltyConfig,
      startDate,
      firstPaymentDate,
      periods
    });

    if (summary) {
      const payoffDate = summary.payoffDate ? new Date(summary.payoffDate) : new Date(firstPaymentDate);
      if (!summary.payoffDate) {
        payoffDate.setMonth(payoffDate.getMonth() + summary.actualMonths - 1);
      }
      const diffTotalMonths = Math.max(0, Math.round((payoffDate - new Date()) / (1000 * 60 * 60 * 24 * 30.44)));
      
      setResult({
        ...summary,
        yearsFromNow: Math.floor(diffTotalMonths / 12),
        monthsFromNow: diffTotalMonths % 12,
      });
      setSchedule(list.map(row => ({ ...row, dateStr: row.date })));
    }
    setShowSchedule(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Tính khoản vay nâng cao">
      <div className="space-y-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">Tải hồ sơ đã lưu:</label>
            {activeProfileId && (
              <button onClick={handleDeleteProfile} className="text-red-500 bg-red-50 p-1.5 rounded-lg active:scale-95 transition-transform" title="Xoá hồ sơ">
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <select value={activeProfileId} onChange={(e) => loadProfile(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 outline-none font-medium text-gray-800 text-sm">
            <option value="">-- Tạo hồ sơ mô phỏng mới --</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex space-x-2 pt-1">
            <button onClick={() => handleSaveProfile(false)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-colors active:scale-95 text-sm">
              <Save size={16} />
              <span>{activeProfileId ? 'Lưu cập nhật' : 'Lưu hồ sơ mới'}</span>
            </button>
            {activeProfileId && (
              <button onClick={() => handleSaveProfile(true)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center transition-colors active:scale-95">
                <FilePlus2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-100 flex items-start space-x-3">
          <Calculator className="mt-0.5 shrink-0" size={20} />
          <p>Mô phỏng khoản vay thực tế: Gốc trả đều, Lãi tính trên dư nợ giảm dần, Tính lãi suất Thả nổi và <strong>mô phỏng tiết kiệm được bao nhiêu tiền/tháng nếu Tất Toán Sớm</strong>.</p>
        </div>

        <form onSubmit={calculateLoan} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
              <span>Thông tin Khế ước</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày giải ngân</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày trả nợ đầu tiên</label>
                <input type="date" value={firstPaymentDate} onChange={e => setFirstPaymentDate(e.target.value)} className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-gray-900" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền vay giải ngân</label>
              <div className="relative">
                <input type="text" inputMode="numeric" value={displayPrincipal} onChange={handlePrincipalChange} placeholder="VD: 1.500.000.000" className="w-full bg-gray-50 text-gray-900 text-xl font-bold py-3 pr-16 pl-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-gray-400">{suffix}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Kỳ hạn vay (Tháng)</label>
              <input type="number" value={termMonths} onChange={e => setTermMonths(e.target.value)} placeholder="VD: 120 (10 năm)" className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lãi ưu đãi (%/năm)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={toViDecimal(promoRate)}
                  onChange={handleRateChange(setPromoRate)}
                  placeholder="0"
                  className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Kéo dài (Tháng)</label>
                <input type="number" value={promoMonths} onChange={e => setPromoMonths(e.target.value)} className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-lg" />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center space-x-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg transition-colors active:scale-95">
              <Settings2 size={16} />
              <span>{showAdvanced ? 'Ẩn Cấu hình Thả nổi & Tất toán' : 'Mở cấu hình Thả nổi & Tất toán sớm'}</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs">2</span>
                  <span>Lãi suất Thả nổi</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Lãi cơ sở (%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={toViDecimal(baseRate)}
                      onChange={handleRateChange(setBaseRate)}
                      className="w-full bg-gray-50 border border-transparent focus:border-orange-500 rounded-xl px-4 py-3 outline-none font-medium text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Biên độ (+%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={toViDecimal(marginRate)}
                      onChange={handleRateChange(setMarginRate)}
                      className="w-full bg-gray-50 border border-transparent focus:border-orange-500 rounded-xl px-4 py-3 outline-none font-medium text-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="font-bold text-gray-900 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">3</span>
                    <span>Kế hoạch theo Giai đoạn</span>
                  </h3>
                  <button type="button" onClick={() => setShowPeriods(v => !v)} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${showPeriods ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{showPeriods ? 'Đang bật' : 'Bật lên'}</button>
                </div>
                {showPeriods && (
                  <div className="space-y-3">
                    {periods.map((pd, idx) => (
                      <div key={idx} className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-purple-700">Giai đoạn {idx + 1}</span>
                          <button type="button" onClick={() => setPeriods(prev => prev.filter((_, i) => i !== idx))} className="text-red-400"><XCircle size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" min="1" value={pd.fromMonth} onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, fromMonth: e.target.value } : p))} className="bg-white rounded-lg px-3 py-2 text-sm font-bold shadow-sm" placeholder="Từ kỳ"/>
                          <input type="number" min="1" value={pd.toMonth} onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, toMonth: e.target.value } : p))} className="bg-white rounded-lg px-3 py-2 text-sm font-bold shadow-sm" placeholder="Đến kỳ"/>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={toViDecimal(pd.rate)}
                            onChange={e => {
                              const v = e.target.value;
                              if (/^[\d,]*$/.test(v)) setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, rate: v } : p));
                            }}
                            className="bg-white rounded-lg px-3 py-2 text-sm font-bold shadow-sm outline-none"
                            placeholder="Lãi suất (%)"
                          />
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatCurrency(pd.budget)}
                              onChange={e => {
                                const numericVal = parseCurrencyInput(e.target.value);
                                setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, budget: numericVal } : p));
                              }}
                              className="w-full bg-white rounded-lg px-3 py-2 pr-10 text-sm font-bold shadow-sm outline-none focus:ring-1 focus:ring-purple-400"
                              placeholder="Ngân sách"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">₫</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => { const last = periods[periods.length - 1]; const nextFrom = last ? parseInt(last.toMonth) + 1 : 1; setPeriods(prev => [...prev, { fromMonth: nextFrom, toMonth: nextFrom + 11, rate: last?.rate || toViDecimal(promoRate) || '', budget: last?.budget || extraPayment || '' }]); }} className="w-full py-2.5 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl font-semibold text-sm">Thêm Giai đoạn</button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">4</span>
                  <span>Kế hoạch Tất toán sớm</span>
                </h3>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Chuỗi phí phạt (%/năm)</label>
                  <input type="text" value={penaltyConfig} onChange={e => setPenaltyConfig(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-medium" placeholder="VD: 3, 3, 3, 1, 0" />
                  <p className="text-[9px] text-gray-400 ml-1">Cách nhau bởi dấu phẩy, mỗi vị trí là 1 năm</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ngân sách trả nợ mỗi tháng</label>
                  <div className="relative">
                    <input type="text" inputMode="numeric" value={displayExtra} onChange={handleExtraChange} className="w-full bg-gray-50 text-gray-900 font-bold py-3 pr-24 pl-4 rounded-xl outline-none" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">{extraSuffix}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ngưỡng kích hoạt Tất Toán</label>
                  <div className="relative">
                    <input type="text" inputMode="numeric" value={displayThreshold} onChange={handleThresholdChange} className="w-full bg-gray-50 text-gray-900 font-bold py-3 pr-24 pl-4 rounded-xl outline-none" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">{thresholdSuffix}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 mt-4 active:scale-95 transition-all">Chạy Mô phỏng Khoản Vay</button>
        </form>

        {result && (
          <div className="mt-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-center border border-gray-100">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Tháng đầu tiên phải trả</p>
              <p className="text-3xl font-black text-gray-900">{formatCurrency(result.initialMonthlyPayment)} ₫</p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-4 mb-6 text-white shadow-md grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <p className="text-slate-300 text-[10px] font-semibold uppercase mb-1">Tổng thời gian</p>
                  <p className="font-black text-xl">{result.totalYears > 0 ? `${result.totalYears}n ` : ''}{result.totalRemMonths}th</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <p className="text-slate-300 text-[10px] font-semibold uppercase mb-1">Tất toán dự kiến</p>
                  <p className="font-black text-lg">{result.payoffDateStr}</p>
                </div>
            </div>

            {result.interestSaved > 0 && (
              <div className="bg-green-600 p-5 rounded-3xl text-white shadow-lg mb-6">
                <h3 className="font-bold text-green-100 mb-4 text-sm uppercase tracking-wider text-center">Hiệu quả Trả nợ sớm</h3>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white/10 p-3 rounded-xl col-span-2 text-center">
                     <p className="text-green-200 text-xs mb-1">Tiết kiệm tiền Lãi</p>
                     <p className="font-bold text-2xl truncate">+{formatCurrency(result.interestSaved)} ₫</p>
                   </div>
                   <div className="bg-white/10 p-3 rounded-xl text-center">
                     <p className="text-green-200 text-xs mb-1">Rút ngắn được</p>
                     <p className="font-bold text-xl">{result.monthsSaved} Tháng</p>
                   </div>
                   <div className="bg-white/10 p-3 rounded-xl text-center">
                     <p className="text-green-200 text-xs mb-1">Tại tháng</p>
                     <p className="font-bold text-xl">{result.actualMonths}</p>
                   </div>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                <span className="text-gray-600 text-sm font-medium">Tổng Lãi (Gốc)</span>
                <span className="font-bold text-gray-900">{formatCurrency(result.baseTotalInterest)} đ</span>
              </div>
              <div className="flex justify-between items-center bg-blue-50 border border-blue-100 p-3 rounded-xl shadow-sm font-bold">
                <span className="text-blue-800 text-sm">Thực trả (Lãi + Phí)</span>
                <span className="text-red-600">{formatCurrency(result.actualTotalInterest + result.totalPenalty)} đ</span>
              </div>
            </div>

            <div className="space-y-3">
              <button onClick={() => setIsAddRealLoanOpen(true)} className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 active:scale-95 transition-all">
                <Landmark size={20} />
                <span>Kích hoạt Hồ sơ vay thực tế</span>
              </button>
              <button onClick={() => setShowSchedule(!showSchedule)} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center justify-center space-x-2">
                <span>{showSchedule ? 'Ẩn Lịch thanh toán' : 'Xem Lịch thanh toán chi tiết'}</span>
                <ChevronRight className={`transition-transform ${showSchedule ? 'rotate-90' : ''}`} size={16} />
              </button>
            </div>

            {showSchedule && schedule.length > 0 && (
              <div className="mt-4 bg-white border border-gray-100 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-[9px] text-right whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-widest border-b">
                    <tr>
                      <th className="px-1.5 py-3 text-center w-8">Kỳ</th>
                      <th className="px-2 py-3 text-left">Ngày</th>
                      <th className="px-2 py-3">Gốc</th>
                      <th className="px-2 py-3">Lãi</th>
                      <th className="px-2 py-3 text-blue-600">Tổng</th>
                      <th className="px-2 py-3 text-emerald-600">Ví tích lũy</th>
                      <th className="px-2 py-3 pr-4">Dư nợ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-semibold text-gray-600">
                    {schedule.map((row) => (
                      <tr key={row.month} className={`${row.prepay > 0 ? 'bg-orange-50/50' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-1.5 py-3 text-center text-gray-400 border-r border-gray-50">{row.month}</td>
                        <td className="px-2 py-3 text-left text-[8px] font-normal">{row.dateStr}</td>
                        <td className="px-2 py-3">{formatCurrency(row.principal)}</td>
                        <td className="px-2 py-3 text-red-400/80">{formatCurrency(row.interest)}</td>
                        <td className="px-2 py-3 font-bold text-gray-900">{formatCurrency(row.total)}</td>
                        <td className="px-2 py-3 text-emerald-700 font-bold">{formatCurrency(row.accumulated)}</td>
                        <td className="px-2 py-3 pr-4 font-black text-gray-900">{formatCurrency(row.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <AddLoanSheet 
        isOpen={isAddRealLoanOpen} 
        onClose={() => setIsAddRealLoanOpen(false)} 
        initialProfile={{
          name: profiles.find(x => x.id === activeProfileId)?.name || 'Khoản vay mới',
          principal, termMonths, promoRate, promoMonths, baseRate, marginRate, penaltyConfig, startDate, firstPaymentDate
        }}
      />
    </BottomSheet>
  );
}
