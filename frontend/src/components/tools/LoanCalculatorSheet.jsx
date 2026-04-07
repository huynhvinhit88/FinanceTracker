import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { formatCurrency } from '../../utils/format';
import { Calculator, ChevronRight, Settings2, Save, FilePlus2, Trash2, PlusCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function LoanCalculatorSheet({ isOpen, onClose }) {
  const { user } = useAuth();
  const storageKey = `loan_profiles_${user?.id || 'guest'}`;

  // Profiles State
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState('');

  // 1. Cấu hình Vay
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [firstPaymentDate, setFirstPaymentDate] = useState(() => {
    // Default: 1 month after today
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const { displayValue: displayPrincipal, value: principal, handleInputChange: handlePrincipalChange, setExternalValue: setExternalPrincipal, reset: resetPrincipal } = useCurrencyInput('');
  const [termMonths, setTermMonths] = useState('');

  // 2. Cấu hình Lãi suất
  const [promoRate, setPromoRate] = useState('');
  const [promoMonths, setPromoMonths] = useState('');
  const [baseRate, setBaseRate] = useState('');
  const [marginRate, setMarginRate] = useState('');

  // 3. Cơ chế Tất toán & Tiết kiệm
  const { displayValue: displayExtra, value: extraPayment, handleInputChange: handleExtraChange, setExternalValue: setExternalExtra, reset: resetExtra } = useCurrencyInput('');
  const { displayValue: displayThreshold, value: offsetThreshold, handleInputChange: handleThresholdChange, setExternalValue: setExternalThreshold, reset: resetThreshold } = useCurrencyInput('');
  const [penaltyConfig, setPenaltyConfig] = useState('3, 3, 3, 1, 0');

  // 4. Kế hoạch theo Giai đoạn (Periods)
  // Mỗi period: { fromMonth, toMonth, rate, budget }
  // rate: lãi suất %/năm; budget: ngân sách trả nợ (nghìn VND, x1000 để lưu)
  const [periods, setPeriods] = useState([]);
  const [showPeriods, setShowPeriods] = useState(false);

  // UI States
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);

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
      // Reset form for a new blank simulation
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

      // Auto expand advanced section if used
      if (p.baseRate || p.extraPayment || p.marginRate) setShowAdvanced(true);
      if (p.periods?.length > 0) { setShowAdvanced(true); setShowPeriods(true); }
      setResult(null); // clear prev result so user runs it again to see
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
      loadProfile(''); // reset to blank
    }
  };

  const calculateLoan = (e) => {
    e.preventDefault();
    if (!principal || !termMonths) return;

    const p = principal;
    const n = parseInt(termMonths);
    const promoR = parseFloat(promoRate) || 0;
    const promoM = parseInt(promoMonths) || 0;

    // Nếu không nhập baseRate/marginRate, mặc định nó bằng promoR
    const fBase = parseFloat(baseRate) || (promoR > 0 ? promoR : 0);
    const fMargin = parseFloat(marginRate) || 0;

    const extraP = extraPayment || 0;
    const threshold = offsetThreshold || 0;

    // --- MÔ PHỎNG GỐC (Bình thường, không trả sớm) ---
    let baseRemaining = p;
    let baseBasePrincipal = p / n; // Gốc trả đều
    let baseTotalInterest = 0;
    let initialMonthlyPayment = 0;

    // Kỳ 1: tính từ ngày giải ngân → ngày trả nợ đầu tiên
    const firstPayDate = new Date(firstPaymentDate);
    const disbDate = new Date(startDate);
    const firstPeriodDays = Math.round((firstPayDate - disbDate) / (1000 * 60 * 60 * 24));

    for (let m = 1; m <= n; m++) {
      let r = (m <= promoM) ? promoR : (fBase + fMargin);

      let days;
      if (m === 1) {
        days = firstPeriodDays; // Kỳ đầu tính đúng số ngày thực tế
      } else {
        // Các kỳ sau: từ tháng trước đến tháng này (tính từ firstPayDate)
        const prevDate = new Date(firstPaymentDate);
        prevDate.setMonth(prevDate.getMonth() + (m - 2));
        const nextDate = new Date(firstPaymentDate);
        nextDate.setMonth(nextDate.getMonth() + (m - 1));
        days = Math.round((nextDate - prevDate) / (1000 * 60 * 60 * 24));
      }

      let interestThisMonth = baseRemaining * (r / 100) * (days / 365);
      baseTotalInterest += interestThisMonth;
      if (m === 1) initialMonthlyPayment = baseBasePrincipal + interestThisMonth;
      baseRemaining -= baseBasePrincipal;
    }

    // --- MÔ PHỎNG THỰC TẾ (Tất toán sớm tích luỹ) ---
    let remaining = p;
    const basePrincipal = p / n;
    let totalInterest = 0;
    let totalPenalty = 0;
    let accumulatedExtra = 0;
    let freePrincipalMonths = 0;
    let actualMonths = 0;
    let generatedSchedule = [];

    // Cấu hình Phạt linh hoạt
    const getPenaltyRate = (month) => {
      const year = Math.ceil(month / 12);
      const rates = penaltyConfig.split(',').map(s => parseFloat(s.trim()));

      let pRate = 0;
      if (rates.length > 0) {
        if (year <= rates.length) {
          pRate = rates[year - 1];
        } else {
          pRate = rates[rates.length - 1]; // Lấy giá trị cuối cùng cho các năm về sau
        }
      }
      return isNaN(pRate) ? 0 : pRate;
    };

    // Helper: lấy thông số từ Periods (nếu có) hoặc fallback về simple rate
    const getPeriodParams = (month) => {
      if (periods && periods.length > 0) {
        const period = periods.find(pd => month >= pd.fromMonth && month <= pd.toMonth);
        if (period) {
          return {
            rate: parseFloat(period.rate) || 0,
            budget: (parseFloat(period.budget) || 0) * 1000, // budget lưu dạng nghìn, đổi về VND
          };
        }
        // Nếu tháng này không khớp period nào, dùng period cuối cùng
        const last = periods[periods.length - 1];
        return {
          rate: parseFloat(last?.rate) || (fBase + fMargin),
          budget: (parseFloat(last?.budget) || 0) * 1000,
        };
      }
      // Không có periods → dùng logic cũ
      const r = (month <= promoM) ? promoR : (fBase + fMargin);
      return { rate: r, budget: extraP };
    };

    for (let m = 1; m <= n; m++) {
      if (remaining <= 100) break; // Tránh sai số thập phân cuối cùng
      actualMonths = m;

      const { rate: r, budget: currentMonthBudget } = getPeriodParams(m);

      // Tính ngày trả nợ kỳ này
      let currentPayDate;
      if (m === 1) {
        currentPayDate = firstPayDate;
      } else {
        currentPayDate = new Date(firstPaymentDate);
        currentPayDate.setMonth(currentPayDate.getMonth() + (m - 1));
      }

      // Số ngày kỳ đầu tiên: giải ngân → ngày trả đầu tiên
      let daysPeriod;
      if (m === 1) {
        daysPeriod = firstPeriodDays;
      } else {
        const prevPayDate = new Date(firstPaymentDate);
        prevPayDate.setMonth(prevPayDate.getMonth() + (m - 2));
        daysPeriod = Math.round((currentPayDate - prevPayDate) / (1000 * 60 * 60 * 24));
      }

      let paymentDateStr = currentPayDate.toLocaleDateString('vi-VN');

      let interestThisMonth = remaining * (r / 100) * (daysPeriod / 365);
      let principalThisMonth = 0;

      // Xử lý ân hạn gốc do tất toán dồn trước đó
      if (freePrincipalMonths > 0) {
        freePrincipalMonths -= 1;
        principalThisMonth = 0;
      } else {
        principalThisMonth = Math.min(basePrincipal, remaining);
      }

      totalInterest += interestThisMonth;
      remaining -= principalThisMonth;

      // Ví tích luỹ = Ngân sách trả nợ hàng tháng - Khoản thực trả cho ngân hàng (Gốc + Lãi)
      const currentBankPayment = principalThisMonth + interestThisMonth;
      if (currentMonthBudget > 0) {
        accumulatedExtra += Math.max(0, currentMonthBudget - currentBankPayment);
      }

      let prepayEvent = 0;
      let penaltyPaid = 0;

      // Kích hoạt ngưỡng Tất toán:
      // Điều kiện: Ví >= Phần thoạt toán + Phí phạt → Ví không bị âm sau khi chi
      if (threshold > 0 && remaining > 0) {
        const prepayAmount = Math.min(threshold, remaining);
        const pRate = getPenaltyRate(m);
        const estimatedPenalty = prepayAmount * (pRate / 100);
        if (accumulatedExtra >= prepayAmount + estimatedPenalty) {
          penaltyPaid = estimatedPenalty;
          totalPenalty += penaltyPaid;

          remaining -= prepayAmount;
          accumulatedExtra -= prepayAmount + penaltyPaid; // ví luôn >= 0
          prepayEvent = prepayAmount;

          // Quy đổi số tiền tất toán thành số tháng được nghỉ nợ gốc
          freePrincipalMonths += prepayAmount / basePrincipal;
        }
      }

      generatedSchedule.push({
        month: m,
        dateStr: paymentDateStr,
        interest: Math.round(interestThisMonth),
        principal: Math.round(principalThisMonth),
        prepay: Math.round(prepayEvent),
        penalty: Math.round(penaltyPaid),
        total: Math.round(currentBankPayment + prepayEvent + penaltyPaid),
        accumulated: Math.round(accumulatedExtra),
        remaining: Math.max(0, Math.round(remaining))
      });
    }

    // Tính ngày tất toán thực tế
    const payoffDate = new Date(firstPaymentDate);
    payoffDate.setMonth(payoffDate.getMonth() + actualMonths - 1);
    const now = new Date();
    const diffMs = payoffDate - now;
    const diffTotalMonths = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
    
    setResult({
      initialMonthlyPayment: Math.round(initialMonthlyPayment),
      baseTotalInterest: Math.round(baseTotalInterest),
      actualTotalInterest: Math.round(totalInterest),
      totalPenalty: Math.round(totalPenalty),
      actualMonths,
      monthsSaved: n - actualMonths,
      interestSaved: Math.round(baseTotalInterest - (totalInterest + totalPenalty)),
      // Thời gian trả hết nợ
      payoffDateStr: payoffDate.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
      totalYears: Math.floor(actualMonths / 12),
      totalRemMonths: actualMonths % 12,
      // Thời gian còn lại từ hôm nay
      yearsFromNow: Math.floor(diffTotalMonths / 12),
      monthsFromNow: diffTotalMonths % 12,
    });
    setSchedule(generatedSchedule);
    setShowSchedule(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Tính khoản vay nâng cao">
      <div className="space-y-6">

        {/* Profile Management Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">Tải hồ sơ đã lưu:</label>
            {activeProfileId && (
              <button onClick={handleDeleteProfile} className="text-red-500 bg-red-50 p-1.5 rounded-lg active:scale-95 transition-transform" title="Xoá hồ sơ">
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <select
            value={activeProfileId}
            onChange={(e) => loadProfile(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 outline-none font-medium text-gray-800 text-sm"
          >
            <option value="">-- Tạo hồ sơ mô phỏng mới --</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex space-x-2 pt-1">
            <button
              onClick={() => handleSaveProfile(false)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-colors active:scale-95 text-sm"
            >
              <Save size={16} />
              <span>{activeProfileId ? 'Lưu cập nhật' : 'Lưu hồ sơ mới'}</span>
            </button>
            {activeProfileId && (
              <button
                onClick={() => handleSaveProfile(true)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center transition-colors active:scale-95"
                title="Nhân bản (Lưu nháp thành hồ sơ khác)"
              >
                <FilePlus2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-100 flex items-start space-x-3">
          <Calculator className="mt-0.5 shrink-0" size={20} />
          <p>Mô phỏng khoản vay thực tế: Gốc trả đều, Lãi tính trên dư nợ giảm dần, Tính lãi suất Thả nổi và Đặc biệt <strong>mô phỏng tiết kiệm được bao nhiêu tiền/tháng nếu Tất Toán Sớm</strong>.</p>
        </div>

        <form onSubmit={calculateLoan} className="space-y-6">
          {/* Thông số Vay cốt lõi */}
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
                <input type="text" inputMode="numeric" value={displayPrincipal} onChange={handlePrincipalChange} placeholder="VD: 1.500.000 (Hiểu là 1,5 Tỷ)" className="w-full bg-gray-50 text-gray-900 text-xl font-bold py-3 pr-16 pl-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-gray-400">.000 ₫</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Kỳ hạn vay (Tháng)</label>
              <input type="number" value={termMonths} onChange={e => setTermMonths(e.target.value)} placeholder="VD: 120 (10 năm)" className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-lg" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lãi ưu đãi (%/năm)</label>
                <input type="number" step="0.01" value={promoRate} onChange={e => setPromoRate(e.target.value)} placeholder="VD: 7.5" className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-lg" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Kéo dài (Tháng)</label>
                <input type="number" value={promoMonths} onChange={e => setPromoMonths(e.target.value)} placeholder="VD: 24" className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-lg" />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center space-x-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg transition-colors active:scale-95">
              <Settings2 size={16} />
              <span>{showAdvanced ? 'Ẩn Cấu hình Thả nổi & Tất toán' : 'Mở cấu hình Thả nổi & Tất toán sớm (Nâng cao)'}</span>
            </button>
          </div>

          {/* Cấu hình nâng cao */}
          {showAdvanced && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs">2</span>
                  <span>Lãi suất Thả nổi (Qua ưu đãi)</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Lãi cơ sở (%)</label>
                    <input type="number" step="0.01" value={baseRate} onChange={e => setBaseRate(e.target.value)} placeholder="Tiết kiệm 24T" className="w-full bg-gray-50 border border-transparent focus:border-orange-500 rounded-xl px-4 py-3 outline-none font-medium text-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Biên độ (+%)</label>
                    <input type="number" step="0.01" value={marginRate} onChange={e => setMarginRate(e.target.value)} placeholder="VD: +3.5" className="w-full bg-gray-50 border border-transparent focus:border-orange-500 rounded-xl px-4 py-3 outline-none font-medium text-lg" />
                  </div>
                </div>
              </div>

              {/* Section: Kế hoạch theo Giai đoạn */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="font-bold text-gray-900 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">3</span>
                    <span>Kế hoạch theo Giai đoạn</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPeriods(v => !v)}
                    className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${showPeriods ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {showPeriods ? 'Đang bật' : 'Bật lên'}
                  </button>
                </div>

                {showPeriods && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 bg-purple-50 p-2 rounded-lg border border-purple-100">
                      <strong>⚡ Ưu tiên cao:</strong> Khi có giai đoạn, hệ thống bỏ qua lãi đơn ở trên và dùng lãi suất & ngân sách của từng giai đoạn tương ứng.
                    </p>
                    {periods.map((pd, idx) => (
                      <div key={idx} className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-purple-700">Giai đoạn {idx + 1}</span>
                          <button type="button" onClick={() => setPeriods(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                            <XCircle size={16} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase">Từ kỳ</label>
                            <input type="number" min="1" value={pd.fromMonth} onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, fromMonth: e.target.value } : p))} className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-purple-500" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase">Đến kỳ</label>
                            <input type="number" min="1" value={pd.toMonth} onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, toMonth: e.target.value } : p))} className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-purple-500" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase">Lãi suất (%/năm)</label>
                            <input type="number" step="0.01" value={pd.rate} onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, rate: e.target.value } : p))} placeholder="VD: 7.5" className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-purple-500" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase">Ngân sách (.000 ₫)</label>
                            <input type="number" value={pd.budget} onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, budget: e.target.value } : p))} placeholder="VD: 25000" className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-purple-500" />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const last = periods[periods.length - 1];
                        const nextFrom = last ? parseInt(last.toMonth) + 1 : 1;
                        setPeriods(prev => [...prev, { fromMonth: nextFrom, toMonth: nextFrom + 11, rate: last?.rate || promoRate || '', budget: last?.budget || (extraPayment / 1000) || '' }]);
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl font-semibold text-sm hover:bg-purple-50 active:scale-95 transition-all"
                    >
                      <PlusCircle size={16} />
                      <span>Thêm Giai đoạn</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">4</span>
                  <span>Kế hoạch Tất toán sớm</span>
                </h3>
                <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 mb-2 opacity-80">
                  <p className="mb-2"><strong>Tip:</strong> Cấu hình hệ thống tự động gom tiền dôi dư hàng tháng để đập vào nợ gốc khi đạt ngưỡng.</p>
                  <div className="space-y-1">
                    <label className="block font-semibold mt-1">Biểu phí phạt trả sớm (%) theo từng năm:</label>
                    <input
                      type="text"
                      value={penaltyConfig}
                      onChange={e => setPenaltyConfig(e.target.value)}
                      placeholder="VD: 3, 3, 3, 1, 0"
                      className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 outline-none font-medium text-gray-800"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">VD: "3, 3, 1, 0" nghĩa là Năm 1-2 phạt 3%, Năm 3 phạt 1%, từ Năm 4 phạt 0%.</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ngân sách trả nợ hàng tháng</label>
                  <div className="relative">
                    <input type="text" inputMode="numeric" value={displayExtra} onChange={handleExtraChange} placeholder="VD: 25.000 (Tổ 25 triệu/tháng)" className="w-full bg-gray-50 text-gray-900 font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                      <span className="text-xl font-bold text-gray-400">.000</span>
                      <span className="text-xl font-bold text-gray-400">₫</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Ví tích luỹ = Ngân sách này − Khoản trả ngân hàng thực tế mỗi tháng</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ngưỡng kích hoạt Tất Toán cục bộ</label>
                  <div className="relative">
                    <input type="text" inputMode="numeric" value={displayThreshold} onChange={handleThresholdChange} placeholder="VD: 50.000 (Tức 50 triệu)" className="w-full bg-gray-50 text-gray-900 font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                      <span className="text-xl font-bold text-gray-400">.000</span>
                      <span className="text-xl font-bold text-gray-400">₫</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 mt-4 active:scale-95 transition-transform">
            Chạy Mô phỏng Khoản Vay
          </button>
        </form>

        {result && (
          <div className="mt-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2">

            {/* Banner Khởi điểm */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-center border border-gray-100">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Tháng đầu tiên bạn phải trả</p>
              <p className="text-3xl font-black text-gray-900">{formatCurrency(result.initialMonthlyPayment)} ₫</p>
              <p className="text-xs text-gray-400 mt-2">Bao gồm Gốc đều + Lãi vay</p>
            </div>

            {/* Timeline Tất toán */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-4 mb-6 text-white shadow-md">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 text-center">Lộ trình tất toán nợ</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <p className="text-slate-300 text-[10px] font-semibold uppercase mb-1">Tổng thời gian vay</p>
                  <p className="font-black text-xl text-white">
                    {result.totalYears > 0 && <span>{result.totalYears}<span className="text-sm font-semibold text-slate-300"> năm </span></span>}
                    {result.totalRemMonths > 0 && <span>{result.totalRemMonths}<span className="text-sm font-semibold text-slate-300"> tháng</span></span>}
                  </p>
                  <p className="text-slate-400 text-[10px] mt-1">({result.actualMonths} kỳ)</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <p className="text-slate-300 text-[10px] font-semibold uppercase mb-1">Dự kiến tất toán</p>
                  <p className="font-black text-lg text-white">{result.payoffDateStr}</p>
                  <p className="text-slate-400 text-[10px] mt-1">
                    {result.yearsFromNow > 0 ? `Còn ${result.yearsFromNow} năm` : ''}
                    {result.yearsFromNow > 0 && result.monthsFromNow > 0 ? ' ' : ''}
                    {result.monthsFromNow > 0 ? `${result.monthsFromNow} tháng nữa` : ''}
                    {result.yearsFromNow === 0 && result.monthsFromNow === 0 ? 'Đã qua hạn' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Hiệu quả tất toán (Chỉ hiện nếu có tiền Saved) */}
            {result.interestSaved > 0 && (
              <div className="bg-gradient-to-br from-green-500 to-green-700 p-5 rounded-3xl text-white shadow-lg mb-6">
                <h3 className="font-bold text-green-100 mb-4 text-sm uppercase tracking-wider text-center">Hiệu quả Tất toán sớm</h3>
                <div className="flex flex-col space-y-4">
                  <div className="bg-white/10 p-3 rounded-xl">
                    <p className="text-green-200 text-xs font-medium mb-1">Tiết kiệm tiền Lãi</p>
                    <p className="font-bold text-2xl truncate">+{formatCurrency(result.interestSaved)} ₫</p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-green-200 text-xs font-medium mb-1">Rút ngắn được</p>
                      <p className="font-bold text-xl">{result.monthsSaved} Tháng</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-200 text-xs font-medium mb-1">Tất toán tại tháng</p>
                      <p className="font-bold text-xl">{result.actualMonths}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-green-400/50 text-xs font-medium text-green-100 text-center">
                  <span>Đã trừ Mức Phạt trả sớm: {formatCurrency(result.totalPenalty)} đ</span>
                </div>
              </div>
            )}

            {/* Bảng so sánh */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                <span className="text-gray-600 text-sm font-medium">Tổng Lãi (Nếu cày đủ kỳ hạn)</span>
                <span className="font-bold text-gray-900">{formatCurrency(result.baseTotalInterest)} đ</span>
              </div>
              <div className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                <span className="text-gray-600 text-sm font-medium">Tổng Lãi (Sau khi trả sớm)</span>
                <span className="font-bold text-gray-900">{formatCurrency(result.actualTotalInterest)} đ</span>
              </div>
              {result.totalPenalty > 0 && (
                <div className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                  <span className="text-gray-600 text-sm font-medium">Tổng phí phạt tất toán</span>
                  <span className="font-bold text-orange-600">+{formatCurrency(result.totalPenalty)} đ</span>
                </div>
              )}
              <div className="flex justify-between items-center bg-blue-50 border border-blue-100 p-3 rounded-xl shadow-sm">
                <span className="text-blue-800 text-sm font-bold">Tổng chi phí thực tế (Lãi + Phí)</span>
                <span className="font-black text-red-600">{formatCurrency(result.actualTotalInterest + result.totalPenalty)} đ</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              <span>{showSchedule ? 'Ẩn Bảng chi tiết dòng tiền' : 'Xem Bảng chi tiết Lịch thanh toán'}</span>
              <ChevronRight className={`transition-transform ${showSchedule ? 'rotate-90' : ''}`} size={16} />
            </button>

            {/* Bảng Lịch trình */}
            {showSchedule && schedule.length > 0 && (
              <div className="mt-4 bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto shadow-sm">
                <table className="w-full text-xs text-right whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">Kỳ</th>
                      <th className="px-3 py-3 text-left">Ngày trả</th>
                      <th className="px-3 py-3">Tiền Gốc</th>
                      <th className="px-3 py-3">Tiền Lãi</th>
                      <th className="px-3 py-3 bg-blue-50/60 text-blue-700">Tổng phải trả</th>
                      <th className="px-3 py-3 bg-green-50/60 text-green-700">Ví tích luỹ</th>
                      <th className="px-4 py-3 text-red-600 bg-red-50/50">Tất Toán</th>
                      <th className="px-3 py-3 pr-4">Dư nợ còn lại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                    {schedule.map((row) => (
                      <tr key={row.month} className={row.prepay > 0 ? 'bg-orange-50/50' : ''}>
                        <td className="px-3 py-3 text-center text-gray-400">{row.month}</td>
                        <td className="px-3 py-3 text-left">{row.dateStr}</td>
                        <td className="px-3 py-3">{formatCurrency(row.principal)}</td>
                        <td className="px-3 py-3 text-red-500">{formatCurrency(row.interest)}</td>
                        <td className="px-3 py-3 bg-blue-50/30 font-bold text-blue-700">{formatCurrency(row.total)}</td>
                        <td className="px-3 py-3 bg-green-50/30 font-semibold text-green-700 italic">{formatCurrency(row.accumulated)}</td>
                        <td className="px-4 py-3 text-red-600 font-bold bg-red-50/20">
                          {row.prepay > 0 ? formatCurrency(row.prepay) : '-'}
                        </td>
                        <td className="px-3 py-3 pr-4 font-bold text-gray-900 border-l border-gray-50">{formatCurrency(row.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}
      </div>
    </BottomSheet>
  );
}
